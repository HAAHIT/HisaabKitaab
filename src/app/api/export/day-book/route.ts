import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { resolveSession } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";
import { parseIndianDateRange } from "@/lib/journal-reporting";
import { getDayBook } from "@/lib/reports/financial-statements";
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

  if (!from || !to) {
    return NextResponse.json({ error: "Date range is required" }, { status: 400 });
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
    const report = await getDayBook(tenantId, fromDate, toDate);

    const wb = new ExcelJS.Workbook();
    wb.creator = "HisaabKitaab";
    wb.created = new Date();

    const ws = wb.addWorksheet("Day Book");
    ws.columns = [
      { header: "Date", width: 14 },
      { header: "Voucher Type", width: 14 },
      { header: "Narration", width: 40 },
      { header: "Account", width: 28 },
      { header: "Party", width: 24 },
      { header: "Debit", width: 14 },
      { header: "Credit", width: 14 },
    ];
    styleHeader(ws.getRow(1));

    const dateFmt = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    for (const day of report.days) {
      for (const v of day.vouchers) {
        for (const l of v.lines) {
          const row = ws.addRow([
            dateFmt.format(v.entryDate),
            v.voucherType,
            v.narration,
            l.accountName,
            l.partyName ?? "",
            l.debit,
            l.credit,
          ]);
          applyMoneyFormat(row.getCell(6));
          applyMoneyFormat(row.getCell(7));
        }
      }
    }

    const totalRow = ws.addRow([
      "",
      "",
      "Period Total",
      "",
      "",
      report.totalDebit,
      report.totalCredit,
    ]);
    applyMoneyFormat(totalRow.getCell(6));
    applyMoneyFormat(totalRow.getCell(7));
    styleTotalRow(totalRow);

    const buffer = await workbookToBuffer(wb);
    return new NextResponse(buffer, {
      headers: xlsxHeaders(`day_book_${from}_to_${to}.xlsx`),
    });
  } catch (error) {
    logError("export.day-book.error", {
      requestId: getRequestId(request),
      error,
    });
    return NextResponse.json({ error: "Failed to export Day Book" }, { status: 500 });
  }
}
