import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSession } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";
import { buildGstr3bSummary, buildGstr3bJson } from "@/lib/reports/gstr";
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
    const [summary, tenant] = await Promise.all([
      buildGstr3bSummary({ tenantId, fyStartYear, fpMonth }),
      prisma.tenant.findUnique({ where: { id: tenantId }, select: { gstin: true } }),
    ]);
    const json = buildGstr3bJson(summary, tenant?.gstin ?? "");
    const body = JSON.stringify(json, null, 2);
    const filename = `GSTR3B_${summary.fp}.json`;
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    logError("reports.gstr3b.json.error", {
      requestId: getRequestId(request),
      error,
    });
    return NextResponse.json(
      { error: "Failed to generate GSTR-3B JSON" },
      { status: 500 }
    );
  }
}
