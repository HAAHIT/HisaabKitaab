import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { resolveSession } from "@/lib/api-tenant";
import { checkFeatureAccess } from "@/lib/quota";
import { logError, getRequestId } from "@/lib/observability";
import { parseIndianDateRange } from "@/lib/journal-reporting";
import { getBalanceSheet } from "@/lib/reports/financial-statements";
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
  const asOf = searchParams.get("asOf") || searchParams.get("to");

  if (!asOf) {
    return NextResponse.json({ error: "asOf date is required" }, { status: 400 });
  }

  let asOfDate: Date;
  try {
    ({ toDate: asOfDate } = parseIndianDateRange(asOf, asOf));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid asOf date" },
      { status: 400 }
    );
  }

  try {
    const report = await getBalanceSheet(tenantId, asOfDate);

    const wb = new ExcelJS.Workbook();
    wb.creator = "HisaabKitaab";
    wb.created = new Date();

    const ws = wb.addWorksheet("Balance Sheet");
    ws.columns = [
      { header: "Section", width: 16 },
      { header: "Group", width: 28 },
      { header: "Account", width: 32 },
      { header: "Amount", width: 18 },
    ];
    styleHeader(ws.getRow(1));

    ws.addRow([`Balance Sheet as of ${asOf}`]).font = { bold: true, size: 13 };
    ws.addRow([]);

    const addAmount = (section: string, group: string, account: string, amount: number) => {
      const row = ws.addRow([section, group, account, amount]);
      applyMoneyFormat(row.getCell(4));
    };

    for (const g of report.assets.groups) {
      for (const a of g.accounts) addAmount("Assets", g.name, a.accountName, a.net);
    }
    const assetsTotal = ws.addRow(["Assets", "", "Total Assets", report.assets.total]);
    applyMoneyFormat(assetsTotal.getCell(4));
    styleTotalRow(assetsTotal);

    ws.addRow([]);

    for (const g of report.liabilities.groups) {
      for (const a of g.accounts) addAmount("Liabilities", g.name, a.accountName, -a.net);
    }
    const liabTotal = ws.addRow(["Liabilities", "", "Total Liabilities", report.liabilities.total]);
    applyMoneyFormat(liabTotal.getCell(4));
    styleTotalRow(liabTotal);

    ws.addRow([]);

    for (const g of report.equity.groups) {
      for (const a of g.accounts) addAmount("Equity", g.name, a.accountName, -a.net);
    }
    addAmount("Equity", "", "Profit & Loss A/c", report.retainedEarnings);
    const equityTotal = ws.addRow([
      "Equity",
      "",
      "Total Equity (with P&L)",
      report.equity.total + report.retainedEarnings,
    ]);
    applyMoneyFormat(equityTotal.getCell(4));
    styleTotalRow(equityTotal);

    ws.addRow([]);
    const grandTotal = ws.addRow([
      "",
      "",
      "Liabilities + Equity",
      report.liabilitiesAndEquityTotal,
    ]);
    applyMoneyFormat(grandTotal.getCell(4));
    grandTotal.font = { bold: true };

    if (report.warnings.length > 0) {
      ws.addRow([]);
      ws.addRow(["Warnings"]).font = { bold: true };
      for (const w of report.warnings) ws.addRow([w]);
    }

    const buffer = await workbookToBuffer(wb);
    return new NextResponse(buffer, {
      headers: xlsxHeaders(`balance_sheet_as_of_${asOf}.xlsx`),
    });
  } catch (error) {
    logError("export.balance-sheet.error", {
      requestId: getRequestId(request),
      error,
    });
    return NextResponse.json({ error: "Failed to export Balance Sheet" }, { status: 500 });
  }
}
