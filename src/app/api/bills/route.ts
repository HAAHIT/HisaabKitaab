import { prisma } from "@/lib/prisma";
import { GST_STATE_CODE_SET } from "@/lib/gst-states";

// Derive Prisma query types from the client instance to avoid the
// @prisma/client → .prisma/client re-export resolution failure
// under moduleResolution:"bundler" in Prisma v7.
type BillWhere = NonNullable<NonNullable<Parameters<typeof prisma.bill.findMany>[0]>["where"]>;
type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type BillRowsJson = NonNullable<Parameters<typeof prisma.bill.create>[0]["data"]>["rows"];
import {
  buildBillSnapshotFromParty,
  getPostedBillBalanceDelta,
  getPaymentBalanceDelta,
} from "@/lib/accounting";
import {
  journalForPaymentMade,
  journalForPaymentReceived,
  journalForSalesBill,
} from "@/lib/journal";
import { NextRequest, NextResponse } from "next/server";
import { resolveReadTenant, resolveWriteTenant } from "@/lib/api-tenant";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { logError, getRequestId } from "@/lib/observability";
import crypto from "crypto";
import { z } from "zod";

function generateLockKey(tenantId: string): bigint {
  const hash = crypto.createHash("sha256").update(tenantId).digest("hex");
  // Use the first 15 hex characters (60 bits) to fit easily into PostgreSQL's 64-bit bigint lock space
  return BigInt("0x" + hash.substring(0, 15));
}

type SupportedPaymentMode = "CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE";
const VALID_PAYMENT_MODES = new Set([
  "CASH",
  "UPI",
  "BANK_TRANSFER",
  "CHEQUE",
]);

function normalizePaymentMode(mode: unknown): SupportedPaymentMode | null {
  if (mode === "BANK") {
    return "BANK_TRANSFER";
  }
  if (typeof mode !== "string") {
    return null;
  }
  return VALID_PAYMENT_MODES.has(mode) ? (mode as SupportedPaymentMode) : null;
}

function isValidBillRequest(finalTemplateId: unknown, partyId: unknown, rows: unknown): boolean {
  if (!finalTemplateId || typeof finalTemplateId !== "string" || !finalTemplateId.trim()) {
    return false;
  }
  if (!partyId || typeof partyId !== "string" || !partyId.trim()) {
    return false;
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return false;
  }
  return true;
}

function parseTenantSettings(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const CreateBillSchema = z.object({
  templateId: z.string().min(1),
  partyId: z.string().min(1),
  customerName: z.string().optional(),
  customerPhone: z.string().nullish(),
  customerAddress: z.string().nullish(),
  // [A3] GSTIN must be a valid 15-character Indian GSTIN format.
  // Regex: 2-digit state code + PAN (5 alpha + 4 digit + 1 alpha) + 1 entity + Z + 1 checksum.
  gstin: z
    .string()
    .regex(GSTIN_REGEX, {
      message:
        "Invalid GSTIN format. Expected 15-character string like 27AAPFU0939F1ZV",
    })
    .nullish(),
  // [B1] Place of Supply — 2-digit GST state code (e.g. "27" for Maharashtra).
  // Required for B2B final bills (GSTIN present) per GSTR-1 Table 4A.
  // Validated against the 37 official GSTN state/UT codes.
  placeOfSupply: z
    .string()
    .refine((val) => GST_STATE_CODE_SET.has(val), {
      message:
        "Invalid place of supply. Must be a 2-digit GST state code (e.g. '27' for Maharashtra).",
    })
    .nullish(),
  rows: z.array(z.record(z.string(), z.unknown())).min(1),
  notes: z.string().nullish(),
  terms: z.string().nullish(),
  taxPercent: z.number().nonnegative().nullish(),
  subtotal: z.number().nonnegative().default(0),
  taxAmount: z.number().nonnegative().default(0),
  grandTotal: z.number().nonnegative().default(0),
  status: z.string().optional(),
  isInterState: z.boolean().optional(),
  paymentMode: z.string().optional(),
}).superRefine((data, ctx) => {
  // [P0] FINAL bills must always declare place of supply for GSTR-1 compliance.
  // Not limited to B2B — even B2C inter-state supplies require placeOfSupply.
  if (data.status === "FINAL" && !data.placeOfSupply) {
    ctx.addIssue({
      code: "custom",
      path: ["placeOfSupply"],
      message:
        "Place of Supply is required for all final bills (mandatory for GSTR-1 compliance).",
    });
  }

  // [P0] FINAL bills with tax must carry at least one HSN/SAC code.
  // Without HSN, GSTR-1 Table 12 (HSN-wise summary) will be incomplete.
  if (
    data.status === "FINAL" &&
    (data.taxPercent ?? 0) > 0 &&
    Array.isArray(data.rows) &&
    !data.rows.some(
      (row) =>
        row &&
        typeof row === "object" &&
        typeof (row as Record<string, unknown>)["_hsnCode"] === "string" &&
        ((row as Record<string, unknown>)["_hsnCode"] as string).trim() !== ""
    )
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["rows"],
      message:
        "At least one HSN/SAC code is required when tax is applied (mandatory for GSTR-1 Table 12).",
    });
  }
});

async function loadBillingSettings(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });

  const tenantSettings = parseTenantSettings(tenant?.settings);
  const billPrefixCandidate =
    typeof tenantSettings.billPrefix === "string"
      ? tenantSettings.billPrefix.trim()
      : "";
  const defaultTaxPercentRaw = tenantSettings.defaultTaxPercent;
  const defaultTaxPercent =
    typeof defaultTaxPercentRaw === "number"
      ? defaultTaxPercentRaw
      : typeof defaultTaxPercentRaw === "string"
        ? Number.parseFloat(defaultTaxPercentRaw)
        : Number.NaN;

  return {
    billPrefix: billPrefixCandidate || "BILL",
    defaultTaxPercent: Number.isFinite(defaultTaxPercent)
      ? defaultTaxPercent
      : 0,
  };
}

// GET /api/bills — List bills with filtering
export async function GET(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const tenantResolution = resolveReadTenant(request);
  if (!tenantResolution.ok) {
    return tenantResolution.response;
  }
  const tenantId = tenantResolution.tenantId;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const partyId = searchParams.get("partyId") || "";
    const partyType = searchParams.get("partyType") || "";
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20);

    const where: any = { isDeleted: false, tenantId };

    if (partyType === "VENDOR") {
      // Purchases always have a vendor linked in this system
      where.party = { type: "VENDOR" };
    } else if (partyType === "CUSTOMER") {
      // Sales can be to a registered Customer OR a walk-in (null partyId)
      where.OR = [
        { party: { type: "CUSTOMER" } },
        { partyId: null },
      ];
    }

    if (search) {
      // If search is present, we need to be careful with existing OR
      const searchOR = [
        { billNumber: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { party: { name: { contains: search, mode: "insensitive" } } },
      ];

      if (where.OR) {
        // If we already have an OR for partyType (CUSTOMER), we nest the search
        where.AND = [
          { OR: where.OR },
          { OR: searchOR }
        ];
        delete where.OR;
      } else {
        where.OR = searchOR;
      }
    }

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (partyId) {
      where.partyId = partyId;
    }

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [bills, total] = await Promise.all([
      prisma.bill.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          billNumber: true,
          partyId: true,
          party: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          customerName: true,
          grandTotal: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.bill.count({ where }),
    ]);

    return NextResponse.json({
      bills,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    logError("bills.list.error", { requestId: getRequestId(request), error });
    return NextResponse.json(
      { error: "Failed to load bills" },
      { status: 500 }
    );
  }
}

// POST /api/bills — Create a new bill
export async function POST(request: NextRequest) {
  const rateLimitResponse = await checkRateLimit(request, "bills.create", 30);
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
    let rawBody: Record<string, unknown>;
    try {
      const bodyText = await request.text();
      if (!bodyText) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      rawBody = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    let body: z.infer<typeof CreateBillSchema>;
    try {
      body = CreateBillSchema.parse(rawBody);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Invalid request", details: err.issues },
          { status: 400 }
        );
      }
      throw err;
    }

    const {
      templateId,
      partyId,
      customerName,
      customerPhone,
      customerAddress,
      gstin,
      rows,
      notes,
      terms,
      taxPercent,
      subtotal,
      taxAmount,
      grandTotal,
      status,
    } = body;

    let finalTemplateId = templateId;
    const isQuickBill = templateId === "__QUICK_BILL__";

    if (!isQuickBill) {
      if (typeof customerName !== "string" || !customerName.trim()) {
        return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
      }
    }

    if (isQuickBill) {
      if (!partyId) {
        return NextResponse.json({ error: "Party is required for Quick Bill" }, { status: 400 });
      }
      if (!grandTotal || grandTotal <= 0) {
        return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 });
      }

      let quickTemplate = await prisma.billTemplate.findFirst({
        where: { name: "__QUICK_BILL__", tenantId },
      });

      if (!quickTemplate) {
        quickTemplate = await prisma.billTemplate.create({
          data: {
            tenantId,
            name: "__QUICK_BILL__",
            columns: [
              { id: "desc", name: "Description", type: "text", position: 0 },
              { id: "amt", name: "Amount", type: "number", position: 1 },
            ],
            createdBy: userId!,
          },
        });
      }
      finalTemplateId = quickTemplate.id;
    }

    if (!isValidBillRequest(finalTemplateId, partyId, rows)) {
      return NextResponse.json(
        { error: "Template, party, and at least one row are required" },
        { status: 400 }
      );
    }

    const template = await prisma.billTemplate.findFirst({
      where: {
        id: finalTemplateId,
        tenantId,
        isDeleted: false,
      },
      select: { id: true },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const party = await prisma.party.findFirst({
      where: {
        id: partyId,
        tenantId,
        isDeleted: false,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        type: true,
        phone: true,
        address: true,
        gstin: true,
      },
    });

    if (!party) {
      return NextResponse.json({ error: "Party not found" }, { status: 404 });
    }

    const billingSettings = await loadBillingSettings(tenantId);
    const prefix = billingSettings.billPrefix;
    
    const resolvedGrandTotal =
      typeof grandTotal === "number" && Number.isFinite(grandTotal)
        ? grandTotal
        : 0;
    const billStatus = status === "FINAL" ? "FINAL" : "DRAFT";
    if (!isQuickBill) {
      if (typeof body.isInterState !== "boolean") {
        return NextResponse.json(
          { error: "isInterState must be a boolean" },
          { status: 400 }
        );
      }
    } else {
      if (body.isInterState !== undefined && typeof body.isInterState !== "boolean") {
        return NextResponse.json(
          { error: "isInterState must be a boolean" },
          { status: 400 }
        );
      }
    }
    const isInterState = body.isInterState === true;
    const normalizedPaymentMode = normalizePaymentMode(body.paymentMode);
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    
    const snapshot = buildBillSnapshotFromParty(party, {
      customerName,
      customerPhone,
      customerAddress,
      gstin,
    });

    if (body.paymentMode && !normalizedPaymentMode) {
      return NextResponse.json(
        { error: "Invalid payment mode" },
        { status: 400 }
      );
    }

    if (billStatus === "FINAL" && resolvedGrandTotal <= 0) {
      return NextResponse.json(
        { error: "Final bills must have a positive total" },
        { status: 400 }
      );
    }

    if (normalizedPaymentMode && billStatus !== "FINAL") {
      return NextResponse.json(
        { error: "Quick Bill payments can only be recorded on final bills" },
        { status: 400 }
      );
    }

    const bill = await prisma.$transaction(async (tx: PrismaTx) => {
      const lockKey = generateLockKey(tenantId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

      const existingCount = await tx.bill.count({
        where: {
          tenantId,
          createdAt: { gte: monthStart, lt: nextMonthStart },
        },
      });
      const billNumber = `${prefix}-${yearMonth}-${String(existingCount + 1).padStart(3, "0")}`;

      const createdBill = await tx.bill.create({
        data: {
          tenantId,
          billNumber,
          templateId: template.id,
          partyId: party.id,
          customerName: snapshot.customerName,
          customerPhone: snapshot.customerPhone,
          customerAddress: snapshot.customerAddress,
          gstin: snapshot.gstin,
          rows: rows as unknown as BillRowsJson,
          notes: notes || null,
          terms: terms || null,
          subtotal: subtotal || 0,
          taxPercent: taxPercent ?? billingSettings.defaultTaxPercent,
          taxAmount: taxAmount || 0,
          grandTotal: resolvedGrandTotal,
          status: billStatus,
          isInterState,
          placeOfSupply: body.placeOfSupply ?? null,  // [B1] GSTR-1 mandatory field
          createdBy: userId!,
          isDeleted: false,
        },
      });

      // [MCA GSR 247(E)] Append-only edit log — mandatory since April 1 2023.
      // Logged inside the same transaction so log entry and bill creation are atomic.
      await tx.auditLog.create({
        data: {
          tenantId,
          entityType: "Bill",
          entityId: createdBill.id,
          userId: userId!,  // guarded: 401 returned at line 302-304 if missing
          action: "CREATE",
          // fieldName / oldValue / newValue = null for whole-record CREATE events
        },
      });

      const balanceChange = getPostedBillBalanceDelta(
        party.type,
        billStatus,
        resolvedGrandTotal
      );

      if (balanceChange !== 0) {
        await tx.party.update({
          where: { id: party.id },
          data: {
            currentBalance: { increment: balanceChange },
          },
        });
      }

      if (billStatus === "FINAL") {
        await journalForSalesBill(tx, tenantId, {
          id: createdBill.id,
          billNumber,
          partyId: party.id,
          partyName: party.name,
          subtotal: createdBill.subtotal.toNumber(),
          taxAmount: createdBill.taxAmount.toNumber(),
          grandTotal: createdBill.grandTotal.toNumber(),
          createdBy: userId!,
          entryDate: createdBill.createdAt,
          isInterState,
        });
      }

      if (isQuickBill && normalizedPaymentMode) {
        const createdPayment = await tx.payment.create({
          data: {
            tenantId,
            partyId: party.id,
            direction: party.type === "CUSTOMER" ? "INCOMING" : "OUTGOING",
            amount: resolvedGrandTotal,
            date: now,
            mode: normalizedPaymentMode,
            status: "COMPLETED",
            linkedBillId: createdBill.id,
            createdBy: userId!,
          },
        });

        const paymentDelta = getPaymentBalanceDelta(
          party.type as "CUSTOMER" | "VENDOR",
          party.type === "CUSTOMER" ? "INCOMING" : "OUTGOING",
          resolvedGrandTotal
        );
        await tx.party.update({
          where: { id: party.id },
          data: { currentBalance: { increment: paymentDelta } },
        });

        if (party.type === "CUSTOMER") {
          await journalForPaymentReceived(tx, tenantId, {
            id: createdPayment.id,
            partyId: party.id,
            partyName: party.name,
            amount: createdPayment.amount.toNumber(),
            mode: createdPayment.mode,
            date: createdPayment.date,
            createdBy: userId!,
          });
        } else {
          await journalForPaymentMade(tx, tenantId, {
            id: createdPayment.id,
            partyId: party.id,
            partyName: party.name,
            amount: createdPayment.amount.toNumber(),
            mode: createdPayment.mode,
            date: createdPayment.date,
            createdBy: userId!,
          });
        }
      }

      return createdBill;
    });

    return NextResponse.json({ bill }, { status: 201 });
  } catch (error) {
    logError("bills.create.error", { requestId: getRequestId(request), error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
