import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  resolveTenantIdFromRequest,
  TENANT_CONTEXT_MISSING_MESSAGE,
} from "@/lib/tenant";
import { CHART_OF_ACCOUNTS } from "@/lib/chart-of-accounts";
import {
  escapeCsv,
  parseIndianDateRange,
  roundTo2,
} from "@/lib/journal-reporting";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  const tenantId = resolveTenantIdFromRequest(request);

  if (role !== "ADMIN" && role !== "ACCOUNTANT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: TENANT_CONTEXT_MISSING_MESSAGE },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const format = searchParams.get("format") || "csv";

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

  const unbalanced = await prisma.journalEntry.count({
    where: { tenantId, isBalanced: false },
  });

  if (unbalanced > 0) {
    return NextResponse.json(
      {
        error: `Export blocked: ${unbalanced} unbalanced journal entries found. Contact support.`,
        unbalancedCount: unbalanced,
      },
      { status: 409 }
    );
  }

  const matchingJournals = await prisma.journalEntry.findMany({
    where: {
      tenantId,
      entryDate: {
        gte: fromDate,
        lte: toDate,
      },
    },
    select: { id: true },
  });

  const journalIds = matchingJournals.map(j => j.id);

  const lines = await prisma.journalLine.findMany({
    where: {
      journalId: { in: journalIds },
    },
  });

  const aggregateMap: Record<string, { 
    accountCode: string; 
    accountName: string; 
    tallyGroup: string; 
    debit: number; 
    credit: number; 
  }> = {};

  for (const line of lines) {
    if (!aggregateMap[line.accountCode]) {
      aggregateMap[line.accountCode] = {
        accountCode: line.accountCode,
        accountName: line.accountName,
        tallyGroup: line.tallyGroup,
        debit: 0,
        credit: 0,
      };
    }
    aggregateMap[line.accountCode].debit += line.debit;
    aggregateMap[line.accountCode].credit += line.credit;
  }

  const aggregates = Object.values(aggregateMap).sort((a, b) => a.accountCode.localeCompare(b.accountCode));

  const rows = aggregates.map((aggregate) => {
    const totalDebit = roundTo2(aggregate.debit || 0);
    const totalCredit = roundTo2(aggregate.credit || 0);
    const netBalance = roundTo2(totalDebit - totalCredit);
    const account = CHART_OF_ACCOUNTS[aggregate.accountCode as keyof typeof CHART_OF_ACCOUNTS];

    return {
      accountCode: aggregate.accountCode,
      accountName: aggregate.accountName,
      tallyGroup: aggregate.tallyGroup,
      type: account?.type || "UNKNOWN",
      totalDebit,
      totalCredit,
      closingDebit: netBalance > 0 ? netBalance : 0,
      closingCredit: netBalance < 0 ? Math.abs(netBalance) : 0,
    };
  });

  const totalDebit = roundTo2(rows.reduce((sum, row) => sum + row.totalDebit, 0));
  const totalCredit = roundTo2(
    rows.reduce((sum, row) => sum + row.totalCredit, 0)
  );
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  if (format === "json") {
    return NextResponse.json({
      rows,
      totalDebit,
      totalCredit,
      isBalanced,
    });
  }

  const csvRows = [
    [
      "Account Name",
      "Tally Group",
      "Type",
      "Total Debit",
      "Total Credit",
      "Closing Debit",
      "Closing Credit",
    ]
      .map(escapeCsv)
      .join(","),
    ...rows.map((row) =>
      [
        row.accountName,
        row.tallyGroup,
        row.type,
        row.totalDebit.toFixed(2),
        row.totalCredit.toFixed(2),
        row.closingDebit.toFixed(2),
        row.closingCredit.toFixed(2),
      ]
        .map(escapeCsv)
        .join(",")
    ),
  ];

  const filename = `trial_balance_${from}_to_${to}.csv`;
  return new NextResponse(csvRows.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
