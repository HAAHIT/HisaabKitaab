import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";
import { parseIndianDateRange } from "@/lib/journal-reporting";
import { getBalanceSheet } from "@/lib/reports/financial-statements";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, role } = sessionResolution.session;

  if (role !== "ADMIN" && role !== "ACCOUNTANT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const asOf = searchParams.get("asOf");

  if (!asOf) {
    return NextResponse.json(
      { error: "asOf date is required" },
      { status: 400 }
    );
  }

  let asOfDate: Date;
  try {
    // Reuse the IST end-of-day parser so the as-of date is inclusive in IST.
    ({ toDate: asOfDate } = parseIndianDateRange(asOf, asOf));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid asOf date" },
      { status: 400 }
    );
  }

  try {
    const report = await getBalanceSheet(tenantId, asOfDate);
    return NextResponse.json({ data: report });
  } catch (error) {
    logError("reports.balance-sheet.error", {
      requestId: getRequestId(request),
      error,
    });
    return NextResponse.json(
      { error: "Failed to generate Balance Sheet report" },
      { status: 500 }
    );
  }
}
