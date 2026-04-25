import { prisma } from "@/lib/prisma";
import { GST_STATE_CODE_SET } from "@/lib/gst-states";
import { deriveIsInterState, VALID_GST_SLABS } from "@/lib/gst-helpers";

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
import { resolveReadTenant, resolveWriteSession } from "@/lib/api-tenant";
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
  // GST 2.0 valid slabs: 0%, 0.25%, 3%, 5%, 18%
  taxPercent: z.number().nonnegative().refine(
    (val) => VALID_GST_SLABS.has(val),
    { message: "Tax rate must be a valid GST slab: 0%, 0.25%, 3%, 5%, or 18%." }
  ).nullish(),
  subtotal: z.number().nonnegative().default(0),
  taxAmount: z.number().nonnegative().default(0),
  grandTotal: z.number().nonnegative().default(0),
  roundOff: z.number().min(-0.99).max(0.99).default(0), // Round-off adjustment (±₹0.99 max)
  status: z.string().optional(),
  isInterState: z.boolean().optional(),
  paymentMode: z.string().optional(),
  hsnCode: z.string().nullish(),
  shippingAddress: z.string().nullish(), // Ship To address
  date: z.string().optional(), // [ADDED] Allow custom issue dates
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
    (data.taxAmount ?? 0) > 0 &&
    Array.isArray(data.rows) &&
    !data.rows.some(
      (row) => {
        if (!row || typeof row !== "object") return false;
        // Check if ANY value contains an HSN code (either col_hsn, _hsnCode, or any key containing 'hsn')
        return Object.entries(row).some(([key, val]) =>
          (key === "col_hsn" || key === "_hsnCode" || key.toLowerCase().includes("hsn")) &&
          typeof val === "string" &&
          val.trim() !== ""
        );
      }
    ) &&
    !(typeof data.hsnCode === "string" && data.hsnCode.trim() !== "")
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
  const tenantResolution = await resolveReadTenant(request);
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
    const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20), 100);

    const where: BillWhere = { isDeleted: false, tenantId };

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
      const searchOR: BillWhere[] = [
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
      where.status = status as import("@prisma/client").BillStatus;
    }

    if (partyId) {
      where.partyId = partyId;
    }

    // [FIX #19] Validate date params before passing to Prisma
    if (from || to) {
      where.createdAt = {};
      if (from) {
        const fromDate = new Date(from);
        if (!Number.isNaN(fromDate.getTime())) where.createdAt.gte = fromDate;
      }
      if (to) {
        const toDate = new Date(to);
        if (!Number.isNaN(toDate.getTime())) where.createdAt.lte = toDate;
      }
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

  // [FIX #5] Use JWT-verified session instead of trusting proxy headers
  const sessionResolution = await resolveWriteSession(request);
  if (!sessionResolution.ok) {
    return sessionResolution.response;
  }
  const { tenantId, userId, role } = sessionResolution.session;

  if (role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
      roundOff,
      status,
      hsnCode,
      shippingAddress,
      date,
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

    // Load tenant GSTIN for inter-state auto-detection (G-C1)
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { gstin: true },
    });

    const resolvedGrandTotal =
      typeof grandTotal === "number" && Number.isFinite(grandTotal)
        ? grandTotal
        : 0;
    const billStatus = status === "FINAL" ? "FINAL" : "DRAFT";
    if (!isQuickBill) {
      if (body.isInterState !== undefined && typeof body.isInterState !== "boolean") {
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
    // [G-C1] Auto-derive from GSTIN state codes; manual override is fallback only
    const effectiveGstin = gstin || party.gstin;
    const isInterState = deriveIsInterState(effectiveGstin, tenant?.gstin, body.isInterState);
    const normalizedPaymentMode = normalizePaymentMode(body.paymentMode);

    // Use the explicitly provided bill date if present, otherwise default to now
    // [FIX #11] Limit backdating to 180 days to prevent altering locked GST periods
    let billDateObj = new Date();
    if (typeof date === "string" && date.trim() !== "") {
      const parsedDate = new Date(date);
      if (!Number.isNaN(parsedDate.getTime())) {
        const maxBackdateDays = 180;
        const minAllowedDate = new Date();
        minAllowedDate.setDate(minAllowedDate.getDate() - maxBackdateDays);
        if (parsedDate < minAllowedDate) {
          return NextResponse.json(
            { error: `Bill date cannot be more than ${maxBackdateDays} days in the past` },
            { status: 400 }
          );
        }
        // [FIX #8] Block future-dated bills — they'd land in wrong GST period
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        if (parsedDate >= tomorrow) {
          return NextResponse.json(
            { error: "Bill date cannot be in the future" },
            { status: 400 }
          );
        }
        billDateObj = parsedDate;
      }
    }

    // Still use the system's current time for yearMonth formatting and period locking (for sequence generation)
    // to strictly prevent sequence clashes, but `date` dictates the financial timestamp.
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
      await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

      // [FIX #1] Use max bill sequence number instead of count to prevent gaps
      // from cancelled/deleted bills causing duplicate numbers on next creation.
      const lastBill = await tx.bill.findFirst({
        where: {
          tenantId,
          billNumber: { startsWith: prefix },
          createdAt: { gte: monthStart, lt: nextMonthStart },
        },
        orderBy: { billNumber: "desc" },
        select: { billNumber: true },
      });
      let nextSeq = 1;
      if (lastBill?.billNumber) {
        const parts = lastBill.billNumber.split("-");
        const lastSeq = parseInt(parts[parts.length - 1], 10);
        if (!Number.isNaN(lastSeq)) nextSeq = lastSeq + 1;
      }
      const billNumber = `${prefix}-${yearMonth}-${String(nextSeq).padStart(3, "0")}`;

      const createdBill = await (tx as any).bill.create({
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
          roundOff: roundOff || 0,
          status: billStatus,
          isInterState,
          placeOfSupply: body.placeOfSupply ?? null,  // [B1] GSTR-1 mandatory field
          hsnCode: hsnCode ?? null, // Fallback HSN Code
          shippingAddress: shippingAddress ?? null,
          date: billDateObj, // Store custom bill date 
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
          roundOff: roundOff || 0,
          createdBy: userId!,
          entryDate: createdBill.date, // Use the custom bill date for accounting ledgers
          isInterState,
        });
      }

      if (isQuickBill && normalizedPaymentMode) {
        const createdPayment = await (tx as any).payment.create({
          data: {
            tenantId,
            partyId: party.id,
            direction: party.type === "CUSTOMER" ? "INCOMING" : "OUTGOING",
            amount: resolvedGrandTotal,
            date: billDateObj, // Payment receives the same backdated date
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
    }, { isolationLevel: "RepeatableRead" });

    return NextResponse.json({ bill }, { status: 201 });
  } catch (error: unknown) {
    // [LB-3] Handle bill number uniqueness collision gracefully
    // Uses duck-typing instead of Prisma namespace import (Prisma v7 bundler compat)
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Bill number conflict — please retry. If this persists, contact support." },
        { status: 409 }
      );
    }
    logError("bills.create.error", { requestId: getRequestId(request), error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
