import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/tenant";
import {
  escapeCsv,
  formatDateForCsv,
  parseIndianDateRange,
} from "@/lib/journal-reporting";

export async function GET(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  if (role !== "ADMIN" && role !== "ACCOUNTANT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantId = await getTenantId();
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
    include: {
      lines: true,
    },
    orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
  });

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
    for (const line of entry.lines) {
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
