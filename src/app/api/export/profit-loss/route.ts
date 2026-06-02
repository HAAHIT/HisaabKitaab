import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { resolveSession } from "@/lib/api-tenant";
import { checkFeatureAccess } from "@/lib/quota";
import { logError, getRequestId } from "@/lib/observability";
import { parseIndianDateRange } from "@/lib/journal-reporting";
import { getProfitAndLoss } from "@/lib/reports/financial-statements";
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

  // [Phase 1 — Plan gate] Excel report exports are a PRO feature; enforce server-side.
  const feature = await checkFeatureAccess(tenantId, "excelReports");
  if (!feature.allowed) {
    return NextResponse.json(
      { error: feature.reason ?? "Feature locked", code: "FEATURE_LOCKED", feature: "excelReports" },
      { status: 402 }
    );
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
    const report = await getProfitAndLoss(tenantId, fromDate, toDate);

    const wb = new ExcelJS.Workbook();
    wb.creator = "HisaabKitaab";
    wb.created = new Date();

    const ws = wb.addWorksheet("Profit & Loss");
    ws.columns = [
      { header: "Section", width: 14 },
      { header: "Group", width: 28 },
      { header: "Account", width: 32 },
      { header: "Amount", width: 18 },
    ];
    styleHeader(ws.getRow(1));

    ws.addRow([`Profit & Loss: ${from} to ${to}`]).font = { bold: true, size: 13 };
    ws.addRow([]);

    const addAmount = (section: string, group: string, account: string, amount: number) => {
      const row = ws.addRow([section, group, account, amount]);
      applyMoneyFormat(row.getCell(4));
    };

    for (const g of report.income.groups) {
      for (const a of g.accounts) addAmount("Income", g.name, a.accountName, -a.net);
    }
    const incomeTotal = ws.addRow(["Income", "", "Total Income", report.income.total]);
    applyMoneyFormat(incomeTotal.getCell(4));
    styleTotalRow(incomeTotal);

    ws.addRow([]);

    for (const g of report.expense.groups) {
      for (const a of g.accounts) addAmount("Expense", g.name, a.accountName, a.net);
    }
    const expenseTotal = ws.addRow(["Expense", "", "Total Expense", report.expense.total]);
    applyMoneyFormat(expenseTotal.getCell(4));
    styleTotalRow(expenseTotal);

    ws.addRow([]);

    const netRow = ws.addRow([
      "",
      "",
      report.netProfit >= 0 ? "Net Profit" : "Net Loss",
      Math.abs(report.netProfit),
    ]);
    applyMoneyFormat(netRow.getCell(4));
    netRow.font = { bold: true, color: { argb: report.netProfit >= 0 ? "FF15803D" : "FFB91C1C" } };

    if (report.warnings.length > 0) {
      ws.addRow([]);
      ws.addRow(["Warnings"]).font = { bold: true };
      for (const w of report.warnings) ws.addRow([w]);
    }

    const buffer = await workbookToBuffer(wb);
    return new NextResponse(buffer, {
      headers: xlsxHeaders(`profit_loss_${from}_to_${to}.xlsx`),
    });
  } catch (error) {
    logError("export.profit-loss.error", {
      requestId: getRequestId(request),
      error,
    });
    return NextResponse.json({ error: "Failed to export Profit & Loss" }, { status: 500 });
  }
}
