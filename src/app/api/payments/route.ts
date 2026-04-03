import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getPaymentBalanceDelta,
  getSettlementDirectionForParty,
} from "@/lib/accounting";
import {
  resolveTenantIdFromRequest,
  TENANT_CONTEXT_MISSING_MESSAGE,
} from "@/lib/tenant";

const VALID_DIRECTIONS = new Set(["INCOMING", "OUTGOING"]);
const VALID_MODES = new Set(["CASH", "UPI", "BANK_TRANSFER", "CHEQUE"]);

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
  const tenantId = resolveTenantIdFromRequest(request);
  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: TENANT_CONTEXT_MISSING_MESSAGE },
      { status: 500 }
    );
  }

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

  if (type && type !== "ALL") {
    where.direction = type;
  }

  if (status && status !== "ALL") {
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

// POST /api/payments - Record a new payment
export async function POST(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  const userId = request.headers.get("x-user-id");
  const tenantId = resolveTenantIdFromRequest(request);

  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!userId) {
    return NextResponse.json({ error: "Missing user context" }, { status: 401 });
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: TENANT_CONTEXT_MISSING_MESSAGE },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { partyId, amount, type, mode, date, notes, billId, status } = body;
    const normalizedAmount = parsePaymentAmount(amount);
    const paymentDate = date ? new Date(date) : new Date();

    if ((!partyId && !billId) || !normalizedAmount || !type || !mode) {
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

    if (!VALID_MODES.has(mode)) {
      return NextResponse.json(
        { error: "Invalid payment mode" },
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

      const paymentId = crypto.randomUUID();
      await tx.$executeRaw`
        INSERT INTO "Payment" (
          "id",
          "tenantId",
          "partyId",
          "direction",
          "amount",
          "date",
          "mode",
          "status",
          "linkedBillId",
          "notes",
          "createdBy",
          "createdAt",
          "isDeleted",
          "updatedAt"
        )
        VALUES (
          ${paymentId},
          ${tenantId},
          ${party.id},
          ${type}::"PayDirection",
          ${normalizedAmount},
          ${paymentDate},
          ${mode}::"PaymentMode",
          ${paymentStatus}::"PaymentStatus",
          ${resolvedBillId},
          ${notes || null},
          ${userId},
          NOW(),
          false,
          NOW()
        )
      `;

      const newPayment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: {
          party: { select: { name: true, type: true } },
          linkedBill: { select: { id: true, billNumber: true } },
        },
      });

      if (!newPayment) {
        throw new Error("Failed to create payment");
      }

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
      }

      return newPayment;
    });

    return NextResponse.json({ payment }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    console.error("Create payment error:", error);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

// PATCH /api/payments - Mark an expected payment as completed
export async function PATCH(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  const tenantId = resolveTenantIdFromRequest(request);

  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: TENANT_CONTEXT_MISSING_MESSAGE },
      { status: 500 }
    );
  }

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
        include: { party: { select: { type: true } } },
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

      return updated;
    });

    return NextResponse.json({ payment: result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    console.error("Mark payment completed error:", error);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
