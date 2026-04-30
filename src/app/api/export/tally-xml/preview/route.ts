import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveReadTenant } from "@/lib/api-tenant";
import { parseIndianDateRange } from "@/lib/journal-reporting";
import { logError, getRequestId } from "@/lib/observability";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const role = request.headers.get("x-user-role");

  if (role !== "ADMIN" && role !== "ACCOUNTANT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const tenantResolution = await resolveReadTenant(request);
  if (!tenantResolution.ok) {
    return tenantResolution.response;
  }
  const tenantId = tenantResolution.tenantId;

  let body: { from?: unknown; to?: unknown } = {};
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const from = typeof body.from === "string" ? body.from : undefined;
  const to = typeof body.to === "string" ? body.to : undefined;
  
  if (!from || !to) {
    return NextResponse.json(
      { error: "Date range (from, to) is required" },
      { status: 400 }
    );
  }

  let fromDate: Date;
  let toDate: Date;
  try {
    ({ fromDate, toDate } = parseIndianDateRange(from, to));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid date range" },
      { status: 400 }
    );
  }

  try {
    // 1. Unbalanced Count
    const unbalancedCount = await prisma.journalEntry.count({
      where: { tenantId, isBalanced: false },
    });

    // 2. Vouchers aggregates
    const salesAgg = await prisma.journalEntry.aggregate({
      where: { tenantId, entryDate: { gte: fromDate, lte: toDate }, voucherType: { in: ["SALES", "CREDIT_NOTE"] } },
      _count: { id: true },
      _sum: { totalDebit: true }
    });

    const purchasesAgg = await prisma.journalEntry.aggregate({
      where: { tenantId, entryDate: { gte: fromDate, lte: toDate }, voucherType: { in: ["PURCHASE", "DEBIT_NOTE"] } },
      _count: { id: true },
      _sum: { totalDebit: true }
    });

    const receiptsAgg = await prisma.journalEntry.aggregate({
      where: { tenantId, entryDate: { gte: fromDate, lte: toDate }, voucherType: "RECEIPT" },
      _count: { id: true },
      _sum: { totalDebit: true }
    });

    const paymentsAgg = await prisma.journalEntry.aggregate({
      where: { tenantId, entryDate: { gte: fromDate, lte: toDate }, voucherType: "PAYMENT" },
      _count: { id: true },
      _sum: { totalDebit: true }
    });

    const journalsAgg = await prisma.journalEntry.aggregate({
      where: { tenantId, entryDate: { gte: fromDate, lte: toDate }, voucherType: "JOURNAL" },
      _count: { id: true },
      _sum: { totalDebit: true }
    });

    // 3. Parties Count
    const partiesCount = await prisma.party.count({
      where: { tenantId, isDeleted: false },
    });

    return NextResponse.json({
      salesCount: salesAgg._count.id,
      salesAmount: Number(salesAgg._sum.totalDebit || 0),
      purchasesCount: purchasesAgg._count.id,
      purchasesAmount: Number(purchasesAgg._sum.totalDebit || 0),
      receiptsCount: receiptsAgg._count.id,
      receiptsAmount: Number(receiptsAgg._sum.totalDebit || 0),
      paymentsCount: paymentsAgg._count.id,
      paymentsAmount: Number(paymentsAgg._sum.totalDebit || 0),
      journalsCount: journalsAgg._count.id,
      partiesCount: partiesCount,
      unbalancedCount,
    });
  } catch (error) {
    logError("export.tally-xml.preview.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
