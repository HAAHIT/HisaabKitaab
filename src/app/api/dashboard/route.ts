import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { logError, getRequestId } from "@/lib/observability";
import { resolveReadTenant } from "@/lib/api-tenant";

/**
 * Handle GET /api/dashboard and return aggregated dashboard metrics for the resolved tenant.
 *
 * Resolves tenant from the incoming request and requires a non-`"CUSTOMER"` `x-user-role` header.
 * Returns 403 if the role is missing or `"CUSTOMER"`, or forwards tenant-resolution responses when resolution fails.
 *
 * @param request - The incoming NextRequest used for tenant resolution and authorization headers
 * @returns A JSON response containing:
 *   - `summary`: aggregated numeric metrics:
 *     - `receivable`: total outstanding receivables (absolute value)
 *     - `payable`: total outstanding payables (absolute value)
 *     - `collectedThisMonth`: sum of completed incoming payments for the current month
 *     - `netBalance`: `receivable - payable`
 *     - `overdueCount`: count of parties with outstanding balances and no payment in the last 30 days
 *   - `cashFlow`: array of six monthly objects `{ month, received, paid }` for the last 6 months
 *   - `recentPayments`: up to 5 most recent completed payments including each payment's party `name` and `type`
 *   - `billStats`: bills grouped by `status` with counts and summed `grandTotal`
 *
 * Possible responses:
 *   - `403` with `{ error: "Forbidden" }` when authorization fails
 *   - `500` with `{ error: "Internal server error" }` on unexpected failures
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
