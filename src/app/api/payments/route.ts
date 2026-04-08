import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getPaymentBalanceDelta,
  getSettlementDirectionForParty,
} from "@/lib/accounting";
import {
  journalForPaymentMade,
  journalForPaymentReceived,
} from "@/lib/journal";
import { resolveReadTenant, resolveWriteTenant } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";
import { checkRateLimit } from "@/lib/api-rate-limit";

export const runtime = "nodejs";

const VALID_DIRECTIONS = new Set(["INCOMING", "OUTGOING"]);
const VALID_MODES = new Set(["CASH", "UPI", "BANK_TRANSFER", "CHEQUE"]);
const VALID_STATUSES = new Set(["EXPECTED", "COMPLETED"]);
type SupportedPaymentDirection = "INCOMING" | "OUTGOING";
type SupportedPaymentMode = "CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE";
type SupportedPaymentStatus = "EXPECTED" | "COMPLETED";

/**
 * Checks whether a string is a supported payment direction.
 *
 * @param value - The string to test
 * @returns `true` if `value` is `"INCOMING"` or `"OUTGOING"`, `false` otherwise
 */
function isPaymentDirection(value: string): value is SupportedPaymentDirection {
  return VALID_DIRECTIONS.has(value);
}

/**
 * Checks whether a string is one of the supported payment statuses.
 *
 * @param value - The value to validate as a payment status
 * @returns `true` if `value` is a supported payment status (`EXPECTED` or `COMPLETED`), `false` otherwise
 */
function isPaymentStatus(value: string): value is SupportedPaymentStatus {
  return VALID_STATUSES.has(value);
}

/**
 * Normalize an arbitrary value into a supported payment mode.
 *
 * @param value - The input to normalize; typically a string (e.g., `"BANK"`, `"CASH"`)
 * @returns The normalized payment mode (`CASH`, `UPI`, `BANK_TRANSFER`, or `CHEQUE`) or `null` if the input is not a recognized mode
 */
function normalizePaymentMode(value: unknown): SupportedPaymentMode | null {
  if (value === "BANK") {
    return "BANK_TRANSFER";
  }

  if (typeof value !== "string") {
    return null;
  }

  return VALID_MODES.has(value) ? (value as SupportedPaymentMode) : null;
}

/**
 * Parse and validate an input as a payment amount.
 *
 * Accepts a number or numeric string, ensures the value is finite and greater than zero,
 * and returns the value rounded to two decimal places.
 *
 * @param value - The input value to parse (number or numeric string)
 * @returns The parsed amount rounded to two decimals, or `null` if the input is not a positive finite number
 */
function parsePaymentAmount(value: unknown) {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value)
        : Number.NaN;

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null;
  }

  return Math.round(numericValue * 100) / 100;
}

/**
 * List payments for the resolved tenant, applying optional filters and pagination.
 *
 * Supports the following query parameters: `search` (party name or notes, case-insensitive), `type` (payment direction), `status` (payment status), `from`/`to` (ISO dates to filter `date`), `page`, and `limit`.
 *
 * Returns a JSON object with the page of payments and pagination metadata.
 *
 * @returns An object containing `payments` (array of payment records with `party` and `linkedBill` relations), `total` (total matching records), `page` (current page number), and `totalPages` (total pages, at least 1).
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

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const type = searchParams.get("type") || "";
  const status = searchParams.get("status") || "";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { isDeleted: false, tenantId };

  if (search) {
    where.OR = [
      { party: { name: { contains: search, mode: "insensitive" } } },
      { notes: { contains: search, mode: "insensitive" } },
    ];
  }

  if (type && type !== "ALL" && isPaymentDirection(type)) {
    where.direction = type;
  }

  if (status && status !== "ALL" && isPaymentStatus(status)) {
    where.status = status;
  }

  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(to);
  }

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        party: { select: { name: true, type: true } },
        linkedBill: { select: { id: true, billNumber: true } },
      },
    }),
    prisma.payment.count({ where }),
  ]);

  return NextResponse.json({
    payments,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}

/**
 * Record a new payment and, when completed, update the party balance and create corresponding journal entries.
 *
 * Validates request tenant and user, normalizes and validates input (amount, mode, date, direction), optionally associates a linked final bill, and creates the payment within a transaction. If the payment is created with status `COMPLETED`, the party's balance is updated and a journal entry is recorded for the payment direction.
 *
 * @returns A JSON HTTP response containing the created `payment` with HTTP 201 on success, or a JSON error object with an appropriate HTTP status (400, 401, or 403) on failure.
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await checkRateLimit(request, "payments.create", 30);
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
    const { partyId, amount, type, mode, date, notes, billId, status } = body;
    const normalizedAmount = parsePaymentAmount(amount);
    const normalizedMode = normalizePaymentMode(mode);
    const paymentDate = date ? new Date(date) : new Date();

    if ((!partyId && !billId) || !normalizedAmount || !type || !normalizedMode) {
      return NextResponse.json(
        { error: "Party or linked bill, amount, type, and mode are required" },
        { status: 400 }
      );
    }
    if (Number.isNaN(paymentDate.getTime())) {
      return NextResponse.json({ error: "Invalid payment date" }, { status: 400 });
    }

    if (!VALID_DIRECTIONS.has(type)) {
      return NextResponse.json(
        { error: "Invalid payment direction" },
        { status: 400 }
      );
    }

    const paymentStatus = status === "EXPECTED" ? "EXPECTED" : "COMPLETED";

    const payment = await prisma.$transaction(async (tx) => {
      let resolvedPartyId = partyId as string | null;
      const resolvedBillId = billId || null;

      if (billId) {
        const linkedBill = await tx.bill.findUnique({
          where: { id: billId },
          select: {
            id: true,
            tenantId: true,
            partyId: true,
            status: true,
            party: {
              select: {
                id: true,
                type: true,
              },
            },
          },
        });

        if (
          !linkedBill ||
          linkedBill.tenantId !== tenantId ||
          linkedBill.status !== "FINAL" ||
          !linkedBill.partyId ||
          !linkedBill.party
        ) {
          throw new Error("Linked bill must be a final bill attached to a party");
        }

        if (resolvedPartyId && resolvedPartyId !== linkedBill.partyId) {
          throw new Error("Linked bill does not belong to the selected party");
        }

        resolvedPartyId = linkedBill.partyId;
        if (type !== getSettlementDirectionForParty(linkedBill.party.type)) {
          throw new Error("Linked bill payments must use the settlement direction for that party");
        }
      }

      if (!resolvedPartyId) {
        throw new Error("Party not found");
      }

      const party = await tx.party.findFirst({
        where: {
          id: resolvedPartyId,
          tenantId,
          isDeleted: false,
          isActive: true,
        },
        select: { id: true, name: true, type: true },
      });

      if (!party) {
        throw new Error("Party not found");
      }

      const newPayment = await tx.payment.create({
        data: {
          tenantId,
          partyId: party.id,
          direction: type,
          amount: normalizedAmount,
          date: paymentDate,
          mode: normalizedMode,
          status: paymentStatus,
          linkedBillId: resolvedBillId,
          notes: notes || null,
          createdBy: userId!,
          isDeleted: false,
        },
        include: {
          party: { select: { name: true, type: true } },
          linkedBill: { select: { id: true, billNumber: true } },
        },
      });

      if (paymentStatus === "COMPLETED") {
        const balanceChange = getPaymentBalanceDelta(
          party.type,
          type,
          normalizedAmount
        );

        await tx.party.update({
          where: { id: party.id },
          data: {
            currentBalance: { increment: balanceChange },
          },
        });

        if (type === "INCOMING") {
          await journalForPaymentReceived(tx, tenantId, {
            id: newPayment.id,
            partyId: party.id,
            partyName: party.name,
            amount: newPayment.amount,
            mode: newPayment.mode,
            date: newPayment.date,
            createdBy: userId!,
          });
        } else {
          await journalForPaymentMade(tx, tenantId, {
            id: newPayment.id,
            partyId: party.id,
            partyName: party.name,
            amount: newPayment.amount,
            mode: newPayment.mode,
            date: newPayment.date,
            createdBy: userId!,
          });
        }
      }

      return newPayment;
    });

    return NextResponse.json({ payment }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    logError("payments.create.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

/**
 * Mark an expected payment as completed, update the party's balance, and record the corresponding journal entry.
 *
 * Expects a JSON body with `paymentId`. Requires a non-customer user role (header `x-user-role`) and write tenant context.
 *
 * @param request - The incoming NextRequest; must include headers `x-user-role` and optionally `x-user-id`, and a JSON body `{ paymentId }`
 * @returns On success, a JSON object with the updated payment under `payment`. On failure, a JSON object with an `error` message and an appropriate HTTP status (403 for forbidden, 400 for bad requests or processing errors).
 */
export async function PATCH(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  const userId = request.headers.get("x-user-id");

  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const tenantResolution = await resolveWriteTenant(request);
  if (!tenantResolution.ok) {
    return tenantResolution.response;
  }
  const tenantId = tenantResolution.tenantId;

  try {
    const body = await request.json();
    const { paymentId } = body;

    if (!paymentId) {
      return NextResponse.json({ error: "Payment ID required" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: {
          id: paymentId,
          tenantId,
          isDeleted: false,
        },
        include: { party: { select: { name: true, type: true } } },
      });

      if (!payment) {
        throw new Error("Payment not found");
      }

      if (payment.status === "COMPLETED") {
        throw new Error("Payment is already completed");
      }

      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: { status: "COMPLETED" },
        include: { party: { select: { name: true, type: true } } },
      });

      const balanceChange = getPaymentBalanceDelta(
        payment.party.type,
        payment.direction,
        payment.amount
      );

      await tx.party.update({
        where: { id: payment.partyId },
        data: {
          currentBalance: { increment: balanceChange },
        },
      });

      if (payment.direction === "INCOMING") {
        await journalForPaymentReceived(tx, tenantId, {
          id: updated.id,
          partyId: payment.partyId,
          partyName: updated.party.name,
          amount: payment.amount,
          mode: payment.mode,
          date: payment.date,
          createdBy: userId || payment.createdBy,
        });
      } else {
        await journalForPaymentMade(tx, tenantId, {
          id: updated.id,
          partyId: payment.partyId,
          partyName: updated.party.name,
          amount: payment.amount,
          mode: payment.mode,
          date: payment.date,
          createdBy: userId || payment.createdBy,
        });
      }

      return updated;
    });

    return NextResponse.json({ payment: result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    logError("payments.complete.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
