import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { resolveSession } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";
import { parseIndianDateRange } from "@/lib/journal-reporting";
import { getAging, type AgingSide } from "@/lib/reports/aging";
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
  const asOfParam = searchParams.get("asOf");

  let asOfDate: Date;
  if (asOfParam) {
    try {
      ({ toDate: asOfDate } = parseIndianDateRange(asOfParam, asOfParam));
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid asOf date" },
        { status: 400 }
      );
    }
  } else {
    asOfDate = new Date();
  }

  try {
    const report = await getAging(tenantId, asOfDate);

    const wb = new ExcelJS.Workbook();
    wb.creator = "HisaabKitaab";
    wb.created = new Date();

    function addSheet(name: string, side: AgingSide) {
      const ws = wb.addWorksheet(name);
      ws.columns = [
        { header: "Party", width: 32 },
        { header: "Current (0-30 days)", width: 20 },
        { header: "31-60 days", width: 16 },
        { header: "61-90 days", width: 16 },
        { header: "90+ days", width: 16 },
        { header: "Total Outstanding", width: 20 },
      ];
      styleHeader(ws.getRow(1));

      for (const p of side.parties) {
        const r = ws.addRow([
          p.partyName,
          p.current,
          p.days_31_60,
          p.days_61_90,
          p.days_90_plus,
          p.total,
        ]);
        applyMoneyFormat(r.getCell(2));
        applyMoneyFormat(r.getCell(3));
        applyMoneyFormat(r.getCell(4));
        applyMoneyFormat(r.getCell(5));
        applyMoneyFormat(r.getCell(6));
      }

      const tr = ws.addRow([
        "Total",
        side.buckets.current,
        side.buckets.days_31_60,
        side.buckets.days_61_90,
        side.buckets.days_90_plus,
        side.buckets.total,
      ]);
      applyMoneyFormat(tr.getCell(2));
      applyMoneyFormat(tr.getCell(3));
      applyMoneyFormat(tr.getCell(4));
      applyMoneyFormat(tr.getCell(5));
      applyMoneyFormat(tr.getCell(6));
      styleTotalRow(tr);
    }

    addSheet("Receivable (A/R)", report.receivable);
    addSheet("Payable (A/P)", report.payable);

    const buffer = await workbookToBuffer(wb);
    const filename = `aging_as_of_${asOfDate.toISOString().slice(0, 10)}.xlsx`;
    return new NextResponse(buffer, { headers: xlsxHeaders(filename) });
  } catch (error) {
    logError("export.aging.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Failed to export Aging" }, { status: 500 });
  }
}
