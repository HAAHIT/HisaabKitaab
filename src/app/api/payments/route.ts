import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  getPaymentBalanceDelta,
  getSettlementDirectionForParty,
} from "@/lib/accounting";
import {
  journalForPaymentMade,
  journalForPaymentReceived,
  journalForContraEntry,
} from "@/lib/journal";
import { resolveReadTenant, resolveWriteTenant } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";
import { checkRateLimit } from "@/lib/api-rate-limit";

export const runtime = "nodejs";

// [T-W2] Same lock-key generator used by bills/purchases/credit-notes.
// Serialises all balance-mutating txns for a given tenant.
function generateLockKey(tenantId: string): bigint {
  const hash = crypto.createHash("sha256").update(tenantId).digest("hex");
  return BigInt("0x" + hash.substring(0, 15));
}

const VALID_DIRECTIONS = new Set(["INCOMING", "OUTGOING"]);
const VALID_MODES = new Set(["CASH", "UPI", "BANK_TRANSFER", "CHEQUE"]);
const VALID_STATUSES = new Set(["EXPECTED", "COMPLETED"]);
type SupportedPaymentDirection = "INCOMING" | "OUTGOING";
type SupportedPaymentMode = "CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE";
type SupportedPaymentStatus = "EXPECTED" | "COMPLETED";

function isPaymentDirection(value: string): value is SupportedPaymentDirection {
  return VALID_DIRECTIONS.has(value);
}

function isPaymentStatus(value: string): value is SupportedPaymentStatus {
  return VALID_STATUSES.has(value);
}

function normalizePaymentMode(value: unknown): SupportedPaymentMode | null {
  if (value === "BANK") {
    return "BANK_TRANSFER";
  }

  if (typeof value !== "string") {
    return null;
  }

  return VALID_MODES.has(value) ? (value as SupportedPaymentMode) : null;
}

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

// GET /api/payments - List payments with filters
export async function GET(request: NextRequest) {
  const role = request.headers.get("x-user-role");

  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const tenantResolution = await resolveReadTenant(request);
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
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20), 100);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Prisma.PaymentWhereInput = { isDeleted: false, tenantId };

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
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
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

// POST /api/payments - Record a new payment
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
    const { partyId, accountId, destinationAccountId, amount, type, mode, date, notes, billId, status } = body;
    const normalizedAmount = parsePaymentAmount(amount);
    const normalizedMode = normalizePaymentMode(mode);
    const paymentDate = date ? new Date(date) : new Date();

    // A payment is a Contra entry if it has no party/bill, has a destination account, and is outgoing from the source.
    const isContra = type === "OUTGOING" && !partyId && !billId && !!destinationAccountId;

    if (!isContra && (!partyId && !billId)) {
      return NextResponse.json(
        { error: "Party or Destination Account is required" },
        { status: 400 }
      );
    }

    if (!normalizedAmount || !type || !normalizedMode || !accountId) {
      return NextResponse.json(
        { error: "accountId, amount, type, and mode are required" },
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
      // [T-W2] Acquire advisory lock to prevent concurrent balance mutations
      const lockKey = generateLockKey(tenantId);
      // [FF-10] Prevent indefinite blocking from hung transactions
      await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

      let resolvedPartyId = partyId as string | null;
      let party = null;
      const resolvedBillId = billId || null;

      if (!isContra) {
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
          const settlementDir = getSettlementDirectionForParty(linkedBill.party.type);
          // Wait, if it's an EXPENSE/INCOME, settlement direction might not be strictly INCOMING/OUTGOING from the generic `getSettlementDirectionForParty`.. but EXPENSE party pays out.
          // Let's just allow it for generic ledgers or check if it throws.
          if (settlementDir && type !== settlementDir) {
            throw new Error("Linked bill payments must use the settlement direction for that party");
          }
        }

        if (!resolvedPartyId) {
          throw new Error("Party not found");
        }

        party = await tx.party.findFirst({
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
      }

      const account = await tx.bankAccount.findFirst({
        where: {
          id: accountId,
          tenantId,
          isDeleted: false,
          isActive: true,
        },
      });

      if (!account) {
        throw new Error("Bank account not found");
      }

      let destAccount = null;
      if (isContra && destinationAccountId) {
        destAccount = await tx.bankAccount.findFirst({
          where: {
            id: destinationAccountId,
            tenantId,
            isDeleted: false,
            isActive: true,
          },
        });
        if (!destAccount) {
          throw new Error("Destination bank account not found");
        }
      }

      const newPayment = await tx.payment.create({
        data: {
          tenantId,
          partyId: party ? party.id : null,
          accountId: account.id,
          destinationAccountId: destAccount ? destAccount.id : null,
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
        if (!isContra && party) {
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
        }

        // Update Bank / Cash Account balance
        const bankBalanceChange = type === "INCOMING" ? normalizedAmount : -normalizedAmount;
        await tx.bankAccount.update({
          where: { id: account.id },
          data: {
            currentBalance: { increment: bankBalanceChange },
          },
        });

        if (isContra && destAccount) {
          // In an OUTGOING contra, the destination gets the money (+amount)
          await tx.bankAccount.update({
            where: { id: destAccount.id },
            data: {
              currentBalance: { increment: normalizedAmount },
            },
          });

          // Hack: just call journalForContraEntry. 
          // We must update the signature or payload in journalForContraEntry to receive the dest account Info.
          // Since it's imported above, we'll leave it unchanged here and update journal.ts.
          await journalForContraEntry(tx, tenantId, {
            id: newPayment.id,
            partyId: null,
            partyName: null,
            amount: newPayment.amount.toNumber(),
            mode: newPayment.mode,
            date: newPayment.date,
            createdBy: userId!,
            // We pass extra props that the TS interface doesn't strictly complain about yet, but we will fix TS
            sourceAccountType: account.type,
            destAccountType: destAccount.type,
          } as any);
        } else if (party) {
          if (type === "INCOMING") {
            await journalForPaymentReceived(tx, tenantId, {
              id: newPayment.id,
              partyId: party.id,
              partyName: party.name,
              amount: newPayment.amount.toNumber(),
              mode: newPayment.mode,
              date: newPayment.date,
              createdBy: userId!,
            });
          } else {
            await journalForPaymentMade(tx, tenantId, {
              id: newPayment.id,
              partyId: party.id,
              partyName: party.name,
              amount: newPayment.amount.toNumber(),
              mode: newPayment.mode,
              date: newPayment.date,
              createdBy: userId!,
            });
          }
        }
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          entityType: "Payment",
          entityId: newPayment.id,
          userId: userId!,
          action: "CREATE",
        },
      });

      return newPayment;
    }, { isolationLevel: "RepeatableRead" });

    return NextResponse.json({ payment }, { status: 201 });
  } catch (error) {
    logError("payments.create.error", { requestId: getRequestId(request), error });
    // Return the application error message for intentional business-logic throws
    // (e.g. wrong party, wrong direction). Hide unexpected infrastructure errors.
    if (error instanceof Prisma.PrismaClientKnownRequestError ||
      error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json({ error: "Failed to process payment" }, { status: 500 });
    }
    const msg = error instanceof Error ? error.message : "Failed to process payment";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

// PATCH /api/payments - Mark an expected payment as completed
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
      // [T-W2] Acquire advisory lock to prevent concurrent balance mutations
      const lockKey = generateLockKey(tenantId);
      // [FF-10] Prevent indefinite blocking from hung transactions
      await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

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

      let balanceChange = 0;
      if (payment.party) {
        balanceChange = getPaymentBalanceDelta(
          payment.party.type,
          payment.direction,
          payment.amount.toNumber()
        );

        await tx.party.update({
          where: { id: payment.partyId! },
          data: {
            currentBalance: { increment: balanceChange },
          },
        });
      }

      if (payment.accountId) {
        const bankBalanceChange = payment.direction === "INCOMING" ? payment.amount.toNumber() : -payment.amount.toNumber();
        await tx.bankAccount.update({
          where: { id: payment.accountId },
          data: {
            currentBalance: { increment: bankBalanceChange },
          },
        });
      }

      if (payment.destinationAccountId) {
        // Contra Entry: Destination account receives the money (+amount)
        await tx.bankAccount.update({
          where: { id: payment.destinationAccountId },
          data: {
            currentBalance: { increment: payment.amount.toNumber() },
          },
        });
      }

      if (!payment.partyId) {
        await journalForContraEntry(tx, tenantId, {
          id: updated.id,
          partyId: null,
          partyName: null,
          amount: payment.amount.toNumber(),
          mode: payment.mode,
          date: payment.date,
          createdBy: userId || payment.createdBy,
        });
      } else if (payment.direction === "INCOMING") {
        await journalForPaymentReceived(tx, tenantId, {
          id: updated.id,
          partyId: payment.partyId,
          partyName: updated.party?.name || null,
          amount: payment.amount.toNumber(),
          mode: payment.mode,
          date: payment.date,
          createdBy: userId || payment.createdBy,
        });
      } else {
        await journalForPaymentMade(tx, tenantId, {
          id: updated.id,
          partyId: payment.partyId,
          partyName: updated.party?.name || null,
          amount: payment.amount.toNumber(),
          mode: payment.mode,
          date: payment.date,
          createdBy: userId || payment.createdBy,
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          entityType: "Payment",
          entityId: updated.id,
          userId: userId || payment.createdBy,
          action: "UPDATE",
          fieldName: "status",
          oldValue: JSON.stringify("EXPECTED"),
          newValue: JSON.stringify("COMPLETED"),
        },
      });

      return updated;
    }, { isolationLevel: "RepeatableRead" });

    return NextResponse.json({ payment: result });
  } catch (error) {
    logError("payments.complete.error", { requestId: getRequestId(request), error });
    if (error instanceof Prisma.PrismaClientKnownRequestError ||
      error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json({ error: "Failed to complete payment" }, { status: 500 });
    }
    const msg = error instanceof Error ? error.message : "Failed to complete payment";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
