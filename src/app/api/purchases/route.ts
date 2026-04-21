import { prisma } from "@/lib/prisma";
import { GST_STATE_CODE_SET } from "@/lib/gst-states";
import {
  buildBillSnapshotFromParty,
  getPostedBillBalanceDelta,
  getPaymentBalanceDelta,
} from "@/lib/accounting";
import { deriveIsInterState } from "@/lib/gst-helpers";
import {
  journalForPaymentMade,
  journalForPurchaseBill,
} from "@/lib/journal";
import { NextRequest, NextResponse } from "next/server";
import { resolveWriteTenant } from "@/lib/api-tenant";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { logError, getRequestId } from "@/lib/observability";
import crypto from "crypto";
import { z } from "zod";

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type BillRowsJson = NonNullable<Parameters<typeof prisma.bill.create>[0]["data"]>["rows"];

function generateLockKey(tenantId: string): bigint {
  const hash = crypto.createHash("sha256").update(tenantId).digest("hex");
  return BigInt("0x" + hash.substring(0, 15));
}

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const CreatePurchaseSchema = z.object({
  partyId: z.string().min(1),
  templateId: z.string().optional(),
  supplierName: z.string().optional(),
  supplierInvoiceNo: z.string().optional(),
  billDate: z.string().datetime().optional(),
  gstin: z.string().regex(GSTIN_REGEX, { message: "Invalid GSTIN format." }).nullish(),
  placeOfSupply: z.string().refine((val) => GST_STATE_CODE_SET.has(val), {
      message: "Invalid place of supply. Must be a 2-digit GST state code.",
    }).nullish(),
  rows: z.array(z.record(z.string(), z.unknown())).min(1),
  notes: z.string().nullish(),
  terms: z.string().nullish(),
  taxPercent: z.number().nonnegative().nullish(),
  subtotal: z.number().nonnegative().default(0),
  taxAmount: z.number().nonnegative().default(0),
  grandTotal: z.number().nonnegative().default(0),
  status: z.string().optional(),
  isInterState: z.boolean().optional(),
  isReverseCharge: z.boolean().optional(),
  paymentMode: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.status === "FINAL" && !data.placeOfSupply) {
    ctx.addIssue({
      code: "custom",
      path: ["placeOfSupply"],
      message: "Place of Supply is required for all final bills.",
    });
  }
});

function roundTo2(num: number) {
  return Math.round(num * 100) / 100;
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = await checkRateLimit(request, "purchases.create", 30);
  if (rateLimitResponse) return rateLimitResponse;

  const role = request.headers.get("x-user-role");
  const userId = request.headers.get("x-user-id");

  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!userId) {
    return NextResponse.json({ error: "Missing user context" }, { status: 401 });
  }
  const tenantResolution = await resolveWriteTenant(request);
  if (!tenantResolution.ok) {
    return tenantResolution.response;
  }
  const tenantId = tenantResolution.tenantId;

  try {
    const rawBody = await request.json();
    let body: z.infer<typeof CreatePurchaseSchema>;
    try {
      body = CreatePurchaseSchema.parse(rawBody);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errorMsg = err.issues.map((i) => i.message).join(", ");
        return NextResponse.json({ error: errorMsg, details: err.issues }, { status: 400 });
      }
      throw err;
    }

    const {
      partyId,
      supplierName,
      supplierInvoiceNo,
      billDate,
      gstin,
      rows,
      notes,
      terms,
      taxPercent,
      subtotal,
      taxAmount,
      grandTotal,
      status,
      isReverseCharge,
      templateId,
    } = body;

    const party = await prisma.party.findFirst({
      where: { id: partyId, tenantId, isDeleted: false, isActive: true },
      select: { id: true, name: true, type: true, phone: true, address: true, gstin: true },
    });

    if (!party) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    if (party.type !== "VENDOR") {
      return NextResponse.json({ error: "Party must be a VENDOR for purchases" }, { status: 400 });
    }

    const resolvedGrandTotal = typeof grandTotal === "number" && Number.isFinite(grandTotal) ? grandTotal : 0;
    const billStatus = status === "FINAL" ? "FINAL" : "DRAFT";

    // Load tenant GSTIN for inter-state auto-detection (G-C1)
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { gstin: true },
    });

    // [G-C1] Auto-derive from GSTIN state codes; manual override is fallback only
    const effectiveGstin = gstin || party.gstin;
    const isInterState = deriveIsInterState(effectiveGstin, tenant?.gstin, body.isInterState);
    const now = new Date();
    
    // Use provided templateId or fallback to __PURCHASE_BILL__
    let template;
    if (templateId) {
      template = await prisma.billTemplate.findFirst({
        where: { id: templateId, tenantId },
      });
    }

    if (!template) {
      template = await prisma.billTemplate.findFirst({
        where: { name: "__PURCHASE_BILL__", tenantId },
      });
      
      if (!template) {
        template = await prisma.billTemplate.create({
          data: {
            tenantId,
            name: "__PURCHASE_BILL__",
            columns: [
              { id: "desc", name: "Description", type: "text", position: 0 },
              { id: "amt", name: "Amount", type: "number", position: 1 },
            ],
            createdBy: userId!,
          },
        });
      }
    }

    if (billStatus === "FINAL" && resolvedGrandTotal <= 0) {
      return NextResponse.json({ error: "Final bills must have a positive total" }, { status: 400 });
    }

    const purchaseBill = await prisma.$transaction(async (tx: PrismaTx) => {
      const lockKey = generateLockKey(tenantId);
      await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

      const billNumber = supplierInvoiceNo || `PUR-${Date.now()}`;

      const createdBill = await tx.bill.create({
        data: {
          tenantId,
          billNumber,
          templateId: template!.id,
          partyId: party.id,
          customerName: supplierName || party.name,
          customerPhone: party.phone,
          customerAddress: party.address,
          gstin: gstin || party.gstin,
          rows: rows as unknown as BillRowsJson,
          notes: notes || null,
          terms: terms || null,
          subtotal: subtotal || 0,
          taxPercent: taxPercent || 0,
          taxAmount: taxAmount || 0,
          grandTotal: resolvedGrandTotal,
          status: billStatus,
          isInterState,
          placeOfSupply: body.placeOfSupply ?? null,
          createdBy: userId!,
          isDeleted: false,
        },
      });

      const balanceChange = getPostedBillBalanceDelta("VENDOR", billStatus, resolvedGrandTotal);

      if (balanceChange !== 0) {
        await tx.party.update({
          where: { id: party.id },
          data: { currentBalance: { increment: balanceChange } },
        });
      }

      if (billStatus === "FINAL") {
        const roundedTax = Math.round(taxAmount);
        const cgst = isInterState ? 0 : Math.round(roundedTax / 2);
        const sgst = isInterState ? 0 : roundedTax - cgst;
        const igst = isInterState ? roundedTax : 0;

        await journalForPurchaseBill(tx, tenantId, {
          id: createdBill.id,
          vendorName: party.name,
          partyId: party.id,
          subtotal: createdBill.subtotal.toNumber(),
          cgst,
          sgst,
          igst,
          grandTotal: createdBill.grandTotal.toNumber(),
          isReverseCharge: isReverseCharge || false,
          createdBy: userId!,
          billDate: billDate ? new Date(billDate) : createdBill.createdAt,
        });
      }

      return createdBill;
    }, { isolationLevel: "RepeatableRead" });

    return NextResponse.json({ bill: purchaseBill }, { status: 201 });
  } catch (error) {
    logError("purchases.create.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
