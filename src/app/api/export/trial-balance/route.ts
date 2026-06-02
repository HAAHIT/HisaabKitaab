import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { resolveSession } from "@/lib/api-tenant";
import { checkFeatureAccess } from "@/lib/quota";
import { CHART_OF_ACCOUNTS } from "@/lib/chart-of-accounts";
import { logError, getRequestId } from "@/lib/observability";
import { parseIndianDateRange, roundTo2 } from "@/lib/journal-reporting";
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
  const format = searchParams.get("format") || "xlsx";

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

    const { lines } = await prisma.$transaction(
      async (tx: any) => {
        const matchingJournals = await tx.journalEntry.findMany({
          where: {
            tenantId,
            isDeleted: false,
            entryDate: { gte: fromDate, lte: toDate },
          },
          select: { id: true },
        });
        const ids = matchingJournals.map((j: any) => j.id);
        const journalLines = await tx.journalLine.findMany({
          where: { journalId: { in: ids } },
        });
        return { journalIds: ids, lines: journalLines };
      },
      { isolationLevel: "RepeatableRead" }
    );

    const aggregateMap: Record<
      string,
      {
        accountCode: string;
        accountName: string;
        tallyGroup: string;
        debit: number;
        credit: number;
      }
    > = {};

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
      aggregateMap[line.accountCode].debit += line.debit.toNumber();
      aggregateMap[line.accountCode].credit += line.credit.toNumber();
    }

    const aggregates = Object.values(aggregateMap).sort((a, b) =>
      a.accountCode.localeCompare(b.accountCode)
    );

    const rows = aggregates.map((aggregate) => {
      const totalDebit = roundTo2(aggregate.debit || 0);
      const totalCredit = roundTo2(aggregate.credit || 0);
      const netBalance = roundTo2(totalDebit - totalCredit);
      const account =
        CHART_OF_ACCOUNTS[aggregate.accountCode as keyof typeof CHART_OF_ACCOUNTS];

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
    const totalCredit = roundTo2(rows.reduce((sum, row) => sum + row.totalCredit, 0));
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

    if (format === "json") {
      return NextResponse.json({ rows, totalDebit, totalCredit, isBalanced });
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = "HisaabKitaab";
    wb.created = new Date();
    const ws = wb.addWorksheet("Trial Balance");
    ws.columns = [
      { header: "Account Name", width: 32 },
      { header: "Tally Group", width: 24 },
      { header: "Type", width: 14 },
      { header: "Total Debit", width: 16 },
      { header: "Total Credit", width: 16 },
      { header: "Closing Debit", width: 16 },
      { header: "Closing Credit", width: 16 },
    ];
    styleHeader(ws.getRow(1));

    for (const row of rows) {
      const r = ws.addRow([
        row.accountName,
        row.tallyGroup,
        row.type,
        row.totalDebit,
        row.totalCredit,
        row.closingDebit,
        row.closingCredit,
      ]);
      applyMoneyFormat(r.getCell(4));
      applyMoneyFormat(r.getCell(5));
      applyMoneyFormat(r.getCell(6));
      applyMoneyFormat(r.getCell(7));
    }

    const totalRow = ws.addRow([
      isBalanced ? "Total (Balanced)" : "Total (Unbalanced)",
      "",
      "",
      totalDebit,
      totalCredit,
      "",
      "",
    ]);
    applyMoneyFormat(totalRow.getCell(4));
    applyMoneyFormat(totalRow.getCell(5));
    styleTotalRow(totalRow);

    const buffer = await workbookToBuffer(wb);
    return new NextResponse(buffer, {
      headers: xlsxHeaders(`trial_balance_${from}_to_${to}.xlsx`),
    });
  } catch (error) {
    logError("export.trial-balance.error", {
      requestId: getRequestId(request),
      error,
    });
    return NextResponse.json(
      { error: "Failed to export trial balance" },
      { status: 500 }
    );
  }
}
