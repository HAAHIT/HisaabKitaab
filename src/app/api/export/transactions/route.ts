import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveReadTenant } from "@/lib/api-tenant";
import {
  escapeCsv,
  formatDateForCsv,
  parseIndianDateRange,
} from "@/lib/journal-reporting";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const role = request.headers.get("x-user-role");

  if (role !== "ADMIN" && role !== "ACCOUNTANT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const tenantResolution = resolveReadTenant(request);
  if (!tenantResolution.ok) {
    return tenantResolution.response;
  }
  const tenantId = tenantResolution.tenantId;

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

  const entries = await prisma.journalEntry.findMany({
    where: {
      tenantId,
      entryDate: {
        gte: fromDate,
        lte: toDate,
      },
    },
    orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
  });

  // Fetch all lines for these entries to avoid "lines" relation type error
  const entryIds = entries.map(e => e.id);
  const allLines = await prisma.journalLine.findMany({
    where: {
      journalId: { in: entryIds }
    }
  });

  // Group lines by journalId
  const linesMap = allLines.reduce((acc, line) => {
    if (!acc[line.journalId]) acc[line.journalId] = [];
    acc[line.journalId].push(line);
    return acc;
  }, {} as Record<string, typeof allLines>);

  if (format === "json") {
    return NextResponse.json({ entries, totalEntries: entries.length });
  }

  const csvRows: string[] = [
    [
      "Date",
      "Voucher Type",
      "Voucher No.",
      "Narration",
      "Ledger Name",
      "Tally Group",
      "Party Name",
      "Debit",
      "Credit",
    ]
      .map(escapeCsv)
      .join(","),
  ];

  for (const entry of entries) {
    const entryLines = linesMap[entry.id] || [];
    for (const line of entryLines) {
      csvRows.push(
        [
          formatDateForCsv(entry.entryDate),
          entry.voucherType,
          entry.billId || entry.purchaseId || entry.paymentId || entry.id,
          entry.narration,
          line.accountName,
          line.tallyGroup,
          line.partyName || "",
          line.debit.toFixed(2),
          line.credit.toFixed(2),
        ]
          .map(escapeCsv)
          .join(",")
      );
    }
  }

  const filename = `transactions_${from}_to_${to}.csv`;
  return new NextResponse(csvRows.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
