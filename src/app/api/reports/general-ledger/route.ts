import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";
import { parseIndianDateRange } from "@/lib/journal-reporting";
import { getGeneralLedger } from "@/lib/reports/financial-statements";
import { CHART_OF_ACCOUNTS, type AccountCode } from "@/lib/chart-of-accounts";

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
      { error: "Date range (from, to) and accountCode are required" },
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
    return NextResponse.json({ data: report });
  } catch (error) {
    logError("reports.general-ledger.error", {
      requestId: getRequestId(request),
      error,
    });
    return NextResponse.json(
      { error: "Failed to generate General Ledger report" },
      { status: 500 }
    );
  }
}
