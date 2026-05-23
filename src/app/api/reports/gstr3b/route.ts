import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";
import { buildGstr3bSummary } from "@/lib/reports/gstr";
import { getIstCalendar } from "@/lib/journal-reporting";

export const runtime = "nodejs";

function defaultPeriod(): { fyStartYear: number; fpMonth: number } {
  const ist = getIstCalendar(new Date());
  const prevMonth = ist.month === 0 ? 12 : ist.month;
  const prevMonthYear = ist.month === 0 ? ist.year - 1 : ist.year;
  const fyStartYear = prevMonth >= 4 ? prevMonthYear : prevMonthYear - 1;
  return { fyStartYear, fpMonth: prevMonth };
}

export async function GET(request: NextRequest) {
  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, role } = sessionResolution.session;

  if (role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const fyParam = searchParams.get("fyStartYear");
  const monthParam = searchParams.get("fpMonth");

  const defaults = defaultPeriod();
  const fyStartYear = fyParam ? parseInt(fyParam, 10) : defaults.fyStartYear;
  const fpMonth = monthParam ? parseInt(monthParam, 10) : defaults.fpMonth;

  if (
    Number.isNaN(fyStartYear) ||
    Number.isNaN(fpMonth) ||
    fpMonth < 1 ||
    fpMonth > 12
  ) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }

  try {
    const summary = await buildGstr3bSummary({ tenantId, fyStartYear, fpMonth });
    return NextResponse.json({ data: summary });
  } catch (error) {
    logError("reports.gstr3b.error", {
      requestId: getRequestId(request),
      error,
    });
    return NextResponse.json(
      { error: "Failed to generate GSTR-3B" },
      { status: 500 }
    );
  }
}
