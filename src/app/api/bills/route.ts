import { prisma } from "@/lib/prisma";
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

const BILL_NUMBER_LOCK_KEY = 22032026;
type SupportedPaymentMode = "CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE";
const VALID_PAYMENT_MODES = new Set([
  "CASH",
  "UPI",
  "BANK_TRANSFER",
  "CHEQUE",
]);

/**
 * Normalize an arbitrary payment-mode input to a supported payment mode identifier.
 *
 * @param mode - The input value to normalize (commonly a string or alias)
 * @returns `SupportedPaymentMode` if `mode` corresponds to a supported payment mode, `null` otherwise.
 */
function normalizePaymentMode(mode: unknown): SupportedPaymentMode | null {
  if (mode === "BANK") {
    return "BANK_TRANSFER";
  }
  if (typeof mode !== "string") {
    return null;
  }
  return VALID_PAYMENT_MODES.has(mode) ? (mode as SupportedPaymentMode) : null;
}

/**
 * Parse tenant settings provided as either an object or a JSON string and return a settings record.
 *
 * @param value - The tenant settings, either an object or a JSON string containing an object. Other values are treated as absent.
 * @returns A `Record<string, unknown>` representing the parsed settings, or an empty object when the input is invalid or cannot be parsed.
 */
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

/**
 * Resolves billing defaults for the given tenant.
 *
 * @param tenantId - The tenant's id whose settings are used to derive billing defaults
 * @returns An object containing:
 *  - `billPrefix` — prefix to use for generated bill numbers (defaults to `"BILL"`).
 *  - `defaultTaxPercent` — tax percentage to apply when not provided (defaults to `0`).
 */
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

/**
 * List bills for the resolved tenant with optional filtering and pagination.
 *
 * Supports the following query parameters: `search` (matches bill number, customer name, or party name), `status` (use `"ALL"` to disable), `partyId`, `from` and `to` (ISO date bounds for `createdAt`), `page`, and `limit`.
 *
 * Requires an `x-user-role` header that is not `"CUSTOMER"`; the request's tenant is resolved via the read-tenant resolver. Returns `403` when the role is missing or is `"CUSTOMER"`. Returns `500` on internal errors.
 *
 * @param request - The incoming NextRequest; must include headers and URL query parameters described above.
 * @returns An object with:
 *  - `bills`: an array of bill summaries (each includes `id`, `billNumber`, `partyId`, `party: { id, name, type }`, `customerName`, `grandTotal`, `status`, `createdAt`),
 *  - `total`: total number of matching bills,
 *  - `page`: current page number,
 *  - `totalPages`: number of pages (at least 1).
 */
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
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { isDeleted: false, tenantId };

    if (search) {
      where.OR = [
        { billNumber: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { party: { name: { contains: search, mode: "insensitive" } } },
      ];
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

/**
 * Create a new bill for the resolved tenant, optionally recording a Quick Bill payment and producing accounting journals and balance updates.
 *
 * Processes the JSON request body to create a bill (DRAFT or FINAL) scoped to the tenant resolved from the request. When `templateId` is `"__QUICK_BILL__"`, the handler ensures a quick-bill template exists, validates required fields, and — if a valid payment mode is provided for a FINAL quick bill — records a payment and creates corresponding payment journals. The operation runs transactionally so bill creation, party balance updates, payments, and journal entries are applied atomically.
 *
 * @param request - The incoming NextRequest. Must include `x-user-role` and `x-user-id` headers and a JSON body containing bill fields (e.g., `templateId`, `partyId`, `rows`, `grandTotal`, `status`, optional `paymentMode`, and other billing fields).
 * @returns A JSON NextResponse containing `{ bill }` with status `201` on success, or a JSON error object with an appropriate HTTP status on failure.
 */
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
    const body = await request.json();
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

    if (!finalTemplateId || !partyId || !Array.isArray(rows) || rows.length === 0) {
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
    if (body.isInterState !== undefined && typeof body.isInterState !== "boolean") {
      return NextResponse.json(
        { error: "isInterState must be a boolean" },
        { status: 400 }
      );
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
        { error: "Invalid payment mode for Quick Bill" },
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

    const bill = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BILL_NUMBER_LOCK_KEY})`;

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
          rows,
          notes: notes || null,
          terms: terms || null,
          subtotal: subtotal || 0,
          taxPercent: taxPercent ?? billingSettings.defaultTaxPercent,
          taxAmount: taxAmount || 0,
          grandTotal: resolvedGrandTotal,
          status: billStatus,
          isInterState,
          createdBy: userId!,
          isDeleted: false,
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
          subtotal: createdBill.subtotal,
          taxAmount: createdBill.taxAmount,
          grandTotal: createdBill.grandTotal,
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
            amount: createdPayment.amount,
            mode: createdPayment.mode,
            date: createdPayment.date,
            createdBy: userId!,
          });
        } else {
          await journalForPaymentMade(tx, tenantId, {
            id: createdPayment.id,
            partyId: party.id,
            partyName: party.name,
            amount: createdPayment.amount,
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
