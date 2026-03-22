import { prisma } from "@/lib/prisma";
import {
  getPaymentBalanceDelta,
  getSettlementDirectionForParty,
} from "@/lib/accounting";
import { NextRequest, NextResponse } from "next/server";

// GET /api/payments — List payments with filters
export async function GET(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const type = searchParams.get("type") || "";
  const status = searchParams.get("status") || "";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { isDeleted: false };

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
    totalPages: Math.ceil(total / limit),
  });
}

// POST /api/payments — Record a new payment
export async function POST(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  const userId = request.headers.get("x-user-id");

  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { partyId, amount, type, mode, date, notes, billId, status } = body;

    if ((!partyId && !billId) || !amount || !type || !mode) {
      return NextResponse.json(
        { error: "Party or linked bill, amount, type, and mode are required" },
        { status: 400 }
      );
    }

    const paymentStatus = status === "EXPECTED" ? "EXPECTED" : "COMPLETED";

    // Create payment and optionally update party balance in a transaction
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payment = await prisma.$transaction(async (tx: any) => {
      let resolvedPartyId = partyId as string | null;
      const resolvedBillId = billId || null;

      if (billId) {
        const linkedBill = await tx.bill.findUnique({
          where: { id: billId },
          select: {
            id: true,
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

        if (!linkedBill || linkedBill.status !== "FINAL" || !linkedBill.partyId || !linkedBill.party) {
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

      const party = await tx.party.findFirst({
        where: {
          id: resolvedPartyId,
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
          partyId: party.id,
          amount: parseFloat(amount),
          direction: type,
          mode,
          status: paymentStatus,
          date: date ? new Date(date) : new Date(),
          notes: notes || null,
          linkedBillId: resolvedBillId,
          createdBy: userId!,
        },
        include: {
          party: { select: { name: true, type: true } },
          linkedBill: { select: { id: true, billNumber: true } },
        },
      });

      // Only update party balance if payment is COMPLETED (money has actually moved)
      if (paymentStatus === "COMPLETED") {
        const amt = parseFloat(amount);
        const balanceChange = getPaymentBalanceDelta(
          party.type,
          type,
          amt
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
    return NextResponse.json(
      { error: msg },
      { status: 400 }
    );
  }
}

// PATCH /api/payments — Mark an expected payment as completed
export async function PATCH(request: NextRequest) {
  const role = request.headers.get("x-user-role");

  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { paymentId } = body;

    if (!paymentId) {
      return NextResponse.json({ error: "Payment ID required" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await prisma.$transaction(async (tx: any) => {
      // Fetch the payment
      const payment = await tx.payment.findUnique({
        where: { id: paymentId, isDeleted: false }, // Ensure payment is not deleted
        include: { party: { select: { type: true } } },
      });

      if (!payment) {
        throw new Error("Payment not found");
      }

      if (payment.status === "COMPLETED") {
        throw new Error("Payment is already completed");
      }

      // Mark as completed
      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: { status: "COMPLETED" },
        include: { party: { select: { name: true, type: true } } },
      });

      // Now apply the balance change
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
