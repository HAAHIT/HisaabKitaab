import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";
import { parseIndianDateRange } from "@/lib/journal-reporting";
import { getAging } from "@/lib/reports/aging";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, role } = sessionResolution.session;

  if (role === "CUSTOMER") {
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
    return NextResponse.json({ data: report });
  } catch (error) {
    logError("reports.aging.error", { requestId: getRequestId(request), error });
    return NextResponse.json(
      { error: "Failed to generate Aging report" },
      { status: 500 }
    );
  }
}
