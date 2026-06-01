import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";
import { checkRateLimit } from "@/lib/api-rate-limit";
import {
  getClosingPreview,
  executeYearEndClose,
  getClosedFinancialYears,
} from "@/lib/year-end-close";
import { getIstCalendar } from "@/lib/journal-reporting";

export const runtime = "nodejs";

function defaultFyStartYear(): number {
  const ist = getIstCalendar(new Date());
  return ist.month >= 3 ? ist.year : ist.year - 1;
}

export async function GET(request: NextRequest) {
  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, role } = sessionResolution.session;

  if (role !== "ADMIN" && role !== "ACCOUNTANT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const fyParam = searchParams.get("fyStartYear");
  const fyStartYear = fyParam ? parseInt(fyParam, 10) : defaultFyStartYear();

  if (Number.isNaN(fyStartYear) || fyStartYear < 2000 || fyStartYear > 2100) {
    return NextResponse.json({ error: "Invalid fyStartYear" }, { status: 400 });
  }

  try {
    const [preview, closedYears] = await Promise.all([
      getClosingPreview(tenantId, fyStartYear),
      getClosedFinancialYears(tenantId),
    ]);
    return NextResponse.json({ data: { preview, closedYears } });
  } catch (error) {
    logError("year-end-close.preview.error", {
      requestId: getRequestId(request),
      error,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load preview" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, role, userId } = sessionResolution.session;

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });
  }

  // Year-end close is irreversible. Cap at 5/min/tenant to limit blast radius
  // of a runaway script or misclick storm.
  const rl = await checkRateLimit(request, `year-end-close:${tenantId}`, 5);
  if (rl) return rl;

  let body: { fyStartYear?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const fyStartYear = body.fyStartYear ?? defaultFyStartYear();
  if (
    typeof fyStartYear !== "number" ||
    Number.isNaN(fyStartYear) ||
    fyStartYear < 2000 ||
    fyStartYear > 2100
  ) {
    return NextResponse.json({ error: "Invalid fyStartYear" }, { status: 400 });
  }

  try {
    const result = await executeYearEndClose(tenantId, fyStartYear, userId);
    return NextResponse.json({ data: result });
  } catch (error) {
    logError("year-end-close.execute.error", {
      requestId: getRequestId(request),
      error,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to close FY" },
      { status: 400 }
    );
  }
}
