import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildPartyLedger,
  getLedgerAmountsForBalanceDelta,
} from "@/lib/accounting";
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
  const tenantResolution = await resolveReadTenant(request);
  if (!tenantResolution.ok) {
    return tenantResolution.response;
  }
  const tenantId = tenantResolution.tenantId;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const partyId = searchParams.get("partyId");
  const format = searchParams.get("format") || "csv";

  if (!from || !to || !partyId) {
    return NextResponse.json(
      { error: "Date range and partyId are required" },
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

  const party = await prisma.party.findFirst({
    where: {
      id: partyId,
      tenantId,
      isDeleted: false,
    },
    select: {
      id: true,
      name: true,
      type: true,
      openingBalance: true,
      createdAt: true,
    },
  });

  if (!party) {
    return NextResponse.json({ error: "Party not found" }, { status: 404 });
  }

  const [bills, payments] = await Promise.all([
    prisma.bill.findMany({
      where: {
        tenantId,
        partyId,
        isDeleted: false,
        status: "FINAL",
        createdAt: {
          lte: toDate,
        },
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        billNumber: true,
        grandTotal: true,
        createdAt: true,
      },
    }),
    prisma.payment.findMany({
      where: {
        tenantId,
        partyId,
        isDeleted: false,
        status: "COMPLETED",
        date: {
          lte: toDate,
        },
      },
      orderBy: { date: "asc" },
      select: {
        id: true,
        amount: true,
        direction: true,
        mode: true,
        date: true,
      },
    }),
  ]);

  const { ledger } = buildPartyLedger({
    partyType: party.type,
    openingBalance: party.openingBalance.toNumber(),
    createdAt: party.createdAt,
    bills: bills.map((b) => ({ ...b, grandTotal: b.grandTotal.toNumber() })),
    payments: payments.map((p) => ({ ...p, amount: p.amount.toNumber() })),
  });

  let openingBalance: number = party.openingBalance.toNumber();
  for (const entry of ledger) {
    if (entry.date.getTime() < fromDate.getTime()) {
      openingBalance = entry.balanceAfter;
      continue;
    }

    break;
  }

  const openingRow = getLedgerAmountsForBalanceDelta(party.type, openingBalance);
  const rangedLedger = ledger.filter(
    (entry) =>
      entry.date.getTime() >= fromDate.getTime() &&
      entry.date.getTime() <= toDate.getTime()
  );

  const rows = [
    {
      date: fromDate,
      description: "Opening Balance",
      debit: openingRow.debit,
      credit: openingRow.credit,
      balanceAfter: openingBalance,
    },
    ...rangedLedger.map((entry) => ({
      date: entry.date,
      description: entry.description,
      debit: entry.debit,
      credit: entry.credit,
      balanceAfter: entry.balanceAfter,
    })),
  ];

  if (format === "json") {
    return NextResponse.json({
      party: { id: party.id, name: party.name, type: party.type },
      rows,
    });
  }

  const csvRows = [
    ["Date", "Description", "Debit", "Credit", "Balance"]
      .map(escapeCsv)
      .join(","),
    ...rows.map((row) =>
      [
        formatDateForCsv(row.date),
        row.description,
        row.debit.toFixed(2),
        row.credit.toFixed(2),
        row.balanceAfter.toFixed(2),
      ]
        .map(escapeCsv)
        .join(",")
    ),
  ];

  const filename = `party_ledger_${party.name.replace(/\s+/g, "_")}_${from}_to_${to}.csv`;
  return new NextResponse(csvRows.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
