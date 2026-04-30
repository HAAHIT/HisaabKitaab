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

    if (request.signal.aborted) return NextResponse.json({ error: "Aborted" }, { status: 499 });

    // Execute aggregated queries directly on Prisma. We remove the interactive $transaction wrapper
    // to allow Prisma's engine to multiplex these over available connections, maximizing throughput.
    // We also monitor request.signal.aborted to immediately bail if the client navigates away.
    const [
      receivableParties,
      payableParties,
      monthPayments,
      recentPayments,
      overdueCount,
      overdueAggregate,
      billStats,
    ] = await Promise.all([
      prisma.party.aggregate({
        where: { tenantId, type: "CUSTOMER", currentBalance: { lt: 0 }, isActive: true, isDeleted: false },
        _sum: { currentBalance: true },
      }),
      prisma.party.aggregate({
        where: { tenantId, type: "VENDOR", currentBalance: { lt: 0 }, isActive: true, isDeleted: false },
        _sum: { currentBalance: true },
      }),
      prisma.payment.aggregate({
        where: { tenantId, direction: "INCOMING", status: "COMPLETED", date: { gte: monthStart, lt: monthEnd } },
        _sum: { amount: true },
      }),
      prisma.payment.findMany({
        where: { tenantId, status: "COMPLETED" },
        orderBy: { date: "desc" },
        take: 5,
        include: { party: { select: { name: true, type: true } } },
      }),
      prisma.party.count({
        where: {
          tenantId, currentBalance: { lt: 0 }, isActive: true, isDeleted: false,
          payments: { none: { isDeleted: false, date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
        },
      }),
      // Aggregate total overdue amount + fetch top overdue party for banner
      prisma.party.aggregate({
        where: {
          tenantId, currentBalance: { lt: 0 }, isActive: true, isDeleted: false,
          payments: { none: { isDeleted: false, date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
        },
        _sum: { currentBalance: true },
      }),
      prisma.bill.groupBy({
        by: ["status"],
        where: { tenantId, isDeleted: false },
        _count: true,
        _sum: { grandTotal: true },
      }),
    ]);

    // When count is small, fetch the top overdue party name for personalized banner
    let topOverduePartyName: string | null = null;
    if (overdueCount > 0 && overdueCount <= 3) {
      const topParty = await prisma.party.findFirst({
        where: {
          tenantId, currentBalance: { lt: 0 }, isActive: true, isDeleted: false,
          payments: { none: { isDeleted: false, date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
        },
        orderBy: { currentBalance: "asc" },
        select: { name: true },
      });
      topOverduePartyName = topParty?.name ?? null;
    }

    const cashFlowResults = [];
    for (const { mStart, mEnd } of monthDetails) {
      if (request.signal.aborted) return NextResponse.json({ error: "Aborted" }, { status: 499 });

      // Process each month. Prisma multiplexes these automatically.
      const [received, paid] = await Promise.all([
        prisma.payment.aggregate({
          where: { tenantId, direction: "INCOMING", status: "COMPLETED", date: { gte: mStart, lt: mEnd } },
          _sum: { amount: true },
        }),
        prisma.payment.aggregate({
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
        overdueAmount: Math.abs(overdueAggregate._sum.currentBalance?.toNumber() ?? 0),
        overdueParty: topOverduePartyName,
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
