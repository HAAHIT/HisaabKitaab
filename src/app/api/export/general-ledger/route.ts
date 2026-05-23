import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { resolveSession } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";
import { parseIndianDateRange } from "@/lib/journal-reporting";
import { getGeneralLedger } from "@/lib/reports/financial-statements";
import { CHART_OF_ACCOUNTS, type AccountCode } from "@/lib/chart-of-accounts";
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
  const accountCode = searchParams.get("accountCode");

  if (!from || !to || !accountCode) {
    return NextResponse.json(
      { error: "Date range and accountCode are required" },
      { status: 400 }
    );
  }

  if (!CHART_OF_ACCOUNTS[accountCode as AccountCode]) {
    return NextResponse.json(
      { error: `Unknown account code: ${accountCode}` },
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
    const report = await getGeneralLedger(tenantId, accountCode, fromDate, toDate);

    const wb = new ExcelJS.Workbook();
    wb.creator = "HisaabKitaab";
    wb.created = new Date();

    const ws = wb.addWorksheet("General Ledger");
    ws.columns = [
      { header: "Date", width: 14 },
      { header: "Voucher", width: 14 },
      { header: "Narration", width: 40 },
      { header: "Party", width: 24 },
      { header: "Debit", width: 14 },
      { header: "Credit", width: 14 },
      { header: "Balance", width: 16 },
    ];
    styleHeader(ws.getRow(1));

    ws.addRow([
      `Account: ${report.accountName} (${report.tallyGroup})`,
    ]).font = { bold: true, size: 12 };
    ws.addRow([`Period: ${from} to ${to}`]);
    ws.addRow([]);

    const openingRow = ws.addRow([
      "",
      "",
      "Opening Balance",
      "",
      "",
      "",
      report.openingBalance,
    ]);
    applyMoneyFormat(openingRow.getCell(7));
    openingRow.font = { italic: true };

    const dateFmt = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    for (const line of report.lines) {
      const row = ws.addRow([
        dateFmt.format(new Date(line.date)),
        line.voucherType,
        line.narration,
        line.partyName ?? "",
        line.debit,
        line.credit,
        line.balance,
      ]);
      applyMoneyFormat(row.getCell(5));
      applyMoneyFormat(row.getCell(6));
      applyMoneyFormat(row.getCell(7));
    }

    const closingRow = ws.addRow([
      "",
      "",
      "Closing Balance",
      "",
      report.totalDebit,
      report.totalCredit,
      report.closingBalance,
    ]);
    applyMoneyFormat(closingRow.getCell(5));
    applyMoneyFormat(closingRow.getCell(6));
    applyMoneyFormat(closingRow.getCell(7));
    styleTotalRow(closingRow);

    const buffer = await workbookToBuffer(wb);
    return new NextResponse(buffer, {
      headers: xlsxHeaders(`general_ledger_${accountCode}_${from}_to_${to}.xlsx`),
    });
  } catch (error) {
    logError("export.general-ledger.error", {
      requestId: getRequestId(request),
      error,
    });
    return NextResponse.json(
      { error: "Failed to export General Ledger" },
      { status: 500 }
    );
  }
}
