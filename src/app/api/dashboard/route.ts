import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/dashboard — Dashboard aggregated data
export async function GET(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Parallel queries for dashboard data
    const [
      receivableParties,
      payableParties,
      monthPayments,
      recentPayments,
      overdueCount,
      billStats,
    ] = await Promise.all([
      // Total receivable (customers who owe us, positive balance)
      prisma.party.aggregate({
        where: { type: "CUSTOMER", currentBalance: { gt: 0 }, isActive: true },
        _sum: { currentBalance: true },
      }),
      // Total payable (vendors we owe, positive balance)
      prisma.party.aggregate({
        where: { type: "VENDOR", currentBalance: { gt: 0 }, isActive: true },
        _sum: { currentBalance: true },
      }),
      // Payments this month (only completed)
      prisma.payment.aggregate({
        where: {
          direction: "INCOMING",
          status: "COMPLETED",
          date: { gte: monthStart, lte: monthEnd },
        },
        _sum: { amount: true },
      }),
      // Recent payments (last 5, completed only)
      prisma.payment.findMany({
        where: { status: "COMPLETED" },
        orderBy: { date: "desc" },
        take: 5,
        include: { party: { select: { name: true, type: true } } },
      }),
      // Overdue count (parties with balance > 0 and no payment in 30 days)
      prisma.party.count({
        where: {
          currentBalance: { gt: 0 },
          isActive: true,
          payments: {
            none: {
              date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
            },
          },
        },
      }),
      // Bill stats
      prisma.bill.groupBy({
        by: ["status"],
        _count: true,
        _sum: { grandTotal: true },
      }),
    ]);

    // Monthly cash flow (last 6 months)
    const cashFlow = [];
    for (let i = 5; i >= 0; i--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const [received, paid] = await Promise.all([
        prisma.payment.aggregate({
          where: { direction: "INCOMING", status: "COMPLETED", date: { gte: mStart, lte: mEnd } },
          _sum: { amount: true },
        }),
        prisma.payment.aggregate({
          where: { direction: "OUTGOING", status: "COMPLETED", date: { gte: mStart, lte: mEnd } },
          _sum: { amount: true },
        }),
      ]);

      cashFlow.push({
        month: mStart.toLocaleDateString("en-IN", {
          month: "short",
          year: "2-digit",
        }),
        received: received._sum.amount || 0,
        paid: paid._sum.amount || 0,
      });
    }

    const receivable = receivableParties._sum.currentBalance || 0;
    const payable = payableParties._sum.currentBalance || 0;
    const collectedThisMonth = monthPayments._sum.amount || 0;

    return NextResponse.json({
      summary: {
        receivable,
        payable,
        collectedThisMonth,
        netBalance: receivable - payable,
        overdueCount,
      },
      cashFlow,
      recentPayments,
      billStats,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
