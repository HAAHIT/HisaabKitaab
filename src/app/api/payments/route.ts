import { prisma } from "@/lib/prisma";
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
  const where: any = {};

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

    if (!partyId || !amount || !type || !mode) {
      return NextResponse.json(
        { error: "Party, amount, type, and mode are required" },
        { status: 400 }
      );
    }

    const paymentStatus = status === "EXPECTED" ? "EXPECTED" : "COMPLETED";

    // Create payment and optionally update party balance in a transaction
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payment = await prisma.$transaction(async (tx: any) => {
      const newPayment = await tx.payment.create({
        data: {
          partyId,
          amount: parseFloat(amount),
          direction: type,
          mode,
          status: paymentStatus,
          date: date ? new Date(date) : new Date(),
          notes: notes || null,
          linkedBillId: billId || null,
          createdBy: userId!,
        },
        include: {
          party: { select: { name: true, type: true } },
        },
      });

      // Only update party balance if payment is COMPLETED (money has actually moved)
      if (paymentStatus === "COMPLETED") {
        let balanceChange = 0;
        const amt = parseFloat(amount);
        if (newPayment.party.type === "CUSTOMER") {
          balanceChange = type === "INCOMING" ? -amt : amt;
        } else {
          balanceChange = type === "OUTGOING" ? -amt : amt;
        }

        await tx.party.update({
          where: { id: partyId },
          data: {
            currentBalance: { increment: balanceChange },
          },
        });
      }

      return newPayment;
    });

    return NextResponse.json({ payment }, { status: 201 });
  } catch (error) {
    console.error("Create payment error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
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
        where: { id: paymentId },
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
      let balanceChange = 0;
      if (payment.party.type === "CUSTOMER") {
        balanceChange = payment.direction === "INCOMING" ? -payment.amount : payment.amount;
      } else {
        balanceChange = payment.direction === "OUTGOING" ? -payment.amount : payment.amount;
      }

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
