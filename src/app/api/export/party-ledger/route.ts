import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import {
  buildPartyLedger,
  getLedgerAmountsForBalanceDelta,
  asSupportedPartyType,
} from "@/lib/accounting";
import { resolveSession } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";
import { parseIndianDateRange } from "@/lib/journal-reporting";
import {
  applyMoneyFormat,
  styleHeader,
  styleTotalRow,
  workbookToBuffer,
  xlsxHeaders,
} from "@/lib/reports/excel";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, role } = sessionResolution.session;

  if (role !== "ADMIN" && role !== "ACCOUNTANT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const partyId = searchParams.get("partyId");
  const format = searchParams.get("format") || "xlsx";

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

  try {
    const unbalanced = await prisma.journalEntry.count({
      where: { tenantId, isBalanced: false, isDeleted: false },
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
      where: { id: partyId, tenantId, isDeleted: false },
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
          date: { lte: toDate },
        },
        orderBy: { date: "asc" },
        select: { id: true, billNumber: true, grandTotal: true, date: true },
      }),
      prisma.payment.findMany({
        where: {
          tenantId,
          partyId,
          isDeleted: false,
          status: "COMPLETED",
          date: { lte: toDate },
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
      partyType: asSupportedPartyType(party.type),
      openingBalance: party.openingBalance.toNumber(),
      createdAt: party.createdAt,
      bills: bills.map((b) => ({
        id: b.id,
        billNumber: b.billNumber,
        date: b.date,
        grandTotal: b.grandTotal.toNumber(),
      })),
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

    const openingRow = getLedgerAmountsForBalanceDelta(
      asSupportedPartyType(party.type),
      openingBalance
    );
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

    const wb = new ExcelJS.Workbook();
    wb.creator = "HisaabKitaab";
    wb.created = new Date();
    const ws = wb.addWorksheet("Party Ledger");
    ws.columns = [
      { header: "Date", width: 14 },
      { header: "Description", width: 44 },
      { header: "Debit", width: 14 },
      { header: "Credit", width: 14 },
      { header: "Balance", width: 16 },
    ];
    styleHeader(ws.getRow(1));

    ws.addRow([`Party: ${party.name} (${party.type})`]).font = {
      bold: true,
      size: 12,
    };
    ws.addRow([`Period: ${from} to ${to}`]);
    ws.addRow([]);

    const dateFmt = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    for (const row of rows) {
      const r = ws.addRow([
        dateFmt.format(row.date),
        row.description,
        row.debit,
        row.credit,
        row.balanceAfter,
      ]);
      applyMoneyFormat(r.getCell(3));
      applyMoneyFormat(r.getCell(4));
      applyMoneyFormat(r.getCell(5));
      if (row.description === "Opening Balance") {
        r.font = { italic: true };
      }
    }

    const lastRow = rows[rows.length - 1];
    if (lastRow) {
      const closing = ws.addRow([
        "",
        "Closing Balance",
        "",
        "",
        lastRow.balanceAfter,
      ]);
      applyMoneyFormat(closing.getCell(5));
      styleTotalRow(closing);
    }

    const buffer = await workbookToBuffer(wb);
    const safeName = party.name.replace(/[^a-zA-Z0-9_-]+/g, "_");
    return new NextResponse(buffer, {
      headers: xlsxHeaders(`party_ledger_${safeName}_${from}_to_${to}.xlsx`),
    });
  } catch (error) {
    logError("export.party-ledger.error", {
      requestId: getRequestId(request),
      error,
    });
    return NextResponse.json(
      { error: "Failed to export party ledger" },
      { status: 500 }
    );
  }
}
