import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { logError, getRequestId } from "@/lib/observability";
import { resolveReadTenant } from "@/lib/api-tenant";

// GET /api/dashboard — Dashboard aggregated data
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

  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Monthly cash flow intervals (last 6 months)
    const monthDetails = Array.from({ length: 6 }, (_, i) => {
      const monthIdx = 5 - i;
      const mStart = new Date(now.getFullYear(), now.getMonth() - monthIdx, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - monthIdx + 1, 1);
      return { mStart, mEnd };
    });

    // Execute ALL queries inside a single interactive transaction to reuse one database connection sequentially.
    // This is critical to prevent connection pool exhaustion hangs during dashboard loads.
    const { 
      receivableParties, payableParties, monthPayments, recentPayments, overdueCount, billStats, cashFlowResults 
    } = await prisma.$transaction(async (tx) => {
      const [
        receivableParties,
        payableParties,
        monthPayments,
        recentPayments,
        overdueCount,
        billStats,
      ] = await Promise.all([
        tx.party.aggregate({
          where: { tenantId, type: "CUSTOMER", currentBalance: { lt: 0 }, isActive: true, isDeleted: false },
          _sum: { currentBalance: true },
        }),
        tx.party.aggregate({
          where: { tenantId, type: "VENDOR", currentBalance: { lt: 0 }, isActive: true, isDeleted: false },
          _sum: { currentBalance: true },
        }),
        tx.payment.aggregate({
          where: { tenantId, direction: "INCOMING", status: "COMPLETED", date: { gte: monthStart, lt: monthEnd } },
          _sum: { amount: true },
        }),
        tx.payment.findMany({
          where: { tenantId, status: "COMPLETED" },
          orderBy: { date: "desc" },
          take: 5,
          include: { party: { select: { name: true, type: true } } },
        }),
        tx.party.count({
          where: {
            tenantId, currentBalance: { lt: 0 }, isActive: true, isDeleted: false,
            payments: { none: { isDeleted: false, date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
          },
        }),
        tx.bill.groupBy({
          by: ["status"],
          where: { tenantId, isDeleted: false },
          _count: true,
          _sum: { grandTotal: true },
        }),
      ]);

      const cashFlowResults = [];
      for (const { mStart, mEnd } of monthDetails) {
        // Sequentially process each month to avoid query bursts
        const [received, paid] = await Promise.all([
          tx.payment.aggregate({
            where: { tenantId, direction: "INCOMING", status: "COMPLETED", date: { gte: mStart, lt: mEnd } },
            _sum: { amount: true },
          }),
          tx.payment.aggregate({
            where: { tenantId, direction: "OUTGOING", status: "COMPLETED", date: { gte: mStart, lt: mEnd } },
            _sum: { amount: true },
          }),
        ]);

        cashFlowResults.push({
          month: mStart.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
          received: received._sum.amount || 0,
          paid: paid._sum.amount || 0,
        });
      }

      return { receivableParties, payableParties, monthPayments, recentPayments, overdueCount, billStats, cashFlowResults };
    });

    const cashFlow = cashFlowResults;

    const receivable = Math.abs(receivableParties._sum.currentBalance?.toNumber() ?? 0);
    const payable = Math.abs(payableParties._sum.currentBalance?.toNumber() ?? 0);
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
