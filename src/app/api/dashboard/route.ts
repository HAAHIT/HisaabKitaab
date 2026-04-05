import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { logError, getRequestId } from "@/lib/observability";
import {
  resolveTenantIdFromRequest,
  TENANT_CONTEXT_MISSING_MESSAGE,
} from "@/lib/tenant";

// GET /api/dashboard — Dashboard aggregated data
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

  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Parallel queries for dashboard data
    const [
      receivableParties,
      payableParties,
      monthPayments,
      recentPayments,
      overdueCount,
      billStats,
    ] = await Promise.all([
      // Total receivable (customers who still owe us, negative balance)
      prisma.party.aggregate({
        where: {
          tenantId,
          type: "CUSTOMER",
          currentBalance: { lt: 0 },
          isActive: true,
          isDeleted: false,
        },
        _sum: { currentBalance: true },
      }),
      // Total payable (vendors we still owe, negative balance)
      prisma.party.aggregate({
        where: {
          tenantId,
          type: "VENDOR",
          currentBalance: { lt: 0 },
          isActive: true,
          isDeleted: false,
        },
        _sum: { currentBalance: true },
      }),
      // Payments this month (only completed)
      prisma.payment.aggregate({
        where: {
          tenantId,
          direction: "INCOMING",
          status: "COMPLETED",
          date: { gte: monthStart, lt: monthEnd },
        },
        _sum: { amount: true },
      }),
      // Recent payments (last 5, completed only)
      prisma.payment.findMany({
        where: {
          tenantId,
          status: "COMPLETED",
        },
        orderBy: { date: "desc" },
        take: 5,
        include: { party: { select: { name: true, type: true } } },
      }),
      // Overdue count (parties with outstanding balance and no payment in 30 days)
      prisma.party.count({
        where: {
          tenantId,
          currentBalance: { lt: 0 },
          isActive: true,
          isDeleted: false,
          payments: {
            none: {
              isDeleted: false,
              date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
            },
          },
        },
      }),
      // Bill stats
      prisma.bill.groupBy({
        by: ["status"],
        where: { tenantId, isDeleted: false },
        _count: true,
        _sum: { grandTotal: true },
      }),
    ]);

    // Monthly cash flow (last 6 months) - parallelized
    const monthDetails = Array.from({ length: 6 }, (_, i) => {
      const monthIdx = 5 - i;
      const mStart = new Date(now.getFullYear(), now.getMonth() - monthIdx, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - monthIdx + 1, 1);
      return { mStart, mEnd };
    });

    const cashFlowResults = await Promise.all(
      monthDetails.map(async ({ mStart, mEnd }) => {
        const [received, paid] = await Promise.all([
          prisma.payment.aggregate({
            where: {
              tenantId,
              direction: "INCOMING",
              status: "COMPLETED",
              date: { gte: mStart, lt: mEnd },
            },
            _sum: { amount: true },
          }),
          prisma.payment.aggregate({
            where: {
              tenantId,
              direction: "OUTGOING",
              status: "COMPLETED",
              date: { gte: mStart, lt: mEnd },
            },
            _sum: { amount: true },
          }),
        ]);

        return {
          month: mStart.toLocaleDateString("en-IN", {
            month: "short",
            year: "2-digit",
          }),
          received: received._sum.amount || 0,
          paid: paid._sum.amount || 0,
        };
      })
    );

    const cashFlow = cashFlowResults;

    const receivable = Math.abs(receivableParties._sum.currentBalance || 0);
    const payable = Math.abs(payableParties._sum.currentBalance || 0);
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
    logError("dashboard.error", { requestId: getRequestId(request), error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
