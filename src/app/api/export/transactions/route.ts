import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { resolveSession } from "@/lib/api-tenant";
import { checkFeatureAccess } from "@/lib/quota";
import { logError, getRequestId } from "@/lib/observability";
import { parseIndianDateRange } from "@/lib/journal-reporting";
import {
  applyMoneyFormat,
  styleHeader,
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

    const entries = await prisma.journalEntry.findMany({
      where: {
        tenantId,
        isDeleted: false,
        entryDate: {
          gte: fromDate,
          lte: toDate,
        },
      },
      orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
    });

    const entryIds = entries.map((e) => e.id);
    const allLines = await prisma.journalLine.findMany({
      where: { journalId: { in: entryIds } },
    });

    const linesMap = allLines.reduce(
      (acc, line) => {
        if (!acc[line.journalId]) acc[line.journalId] = [];
        acc[line.journalId].push(line);
        return acc;
      },
      {} as Record<string, typeof allLines>
    );

    if (format === "json") {
      return NextResponse.json({ entries, totalEntries: entries.length });
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = "HisaabKitaab";
    wb.created = new Date();
    const ws = wb.addWorksheet("Transactions");
    ws.columns = [
      { header: "Date", width: 14 },
      { header: "Voucher Type", width: 14 },
      { header: "Voucher No.", width: 24 },
      { header: "Narration", width: 40 },
      { header: "Ledger Name", width: 28 },
      { header: "Tally Group", width: 22 },
      { header: "Party Name", width: 24 },
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

    for (const entry of entries) {
      const entryLines = linesMap[entry.id] || [];
      for (const line of entryLines) {
        const row = ws.addRow([
          dateFmt.format(entry.entryDate),
          entry.voucherType,
          entry.billId || entry.purchaseId || entry.paymentId || entry.id,
          entry.narration,
          line.accountName,
          line.tallyGroup,
          line.partyName || "",
          Number(line.debit),
          Number(line.credit),
        ]);
        applyMoneyFormat(row.getCell(8));
        applyMoneyFormat(row.getCell(9));
      }
    }

    const buffer = await workbookToBuffer(wb);
    return new NextResponse(buffer, {
      headers: xlsxHeaders(`transactions_${from}_to_${to}.xlsx`),
    });
  } catch (error) {
    logError("export.transactions.error", {
      requestId: getRequestId(request),
      error,
    });
    return NextResponse.json(
      { error: "Failed to export transactions" },
      { status: 500 }
    );
  }
}
