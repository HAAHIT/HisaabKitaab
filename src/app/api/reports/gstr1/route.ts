import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/api-tenant";
import { checkFeatureAccess } from "@/lib/quota";
import { logError, getRequestId } from "@/lib/observability";
import { buildGstr1Json } from "@/lib/reports/gstr";
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

  // [Phase 1 — Plan gate] GST returns are a PRO feature; enforce server-side.
  const feature = await checkFeatureAccess(tenantId, "gstReturns");
  if (!feature.allowed) {
    return NextResponse.json(
      { error: feature.reason ?? "Feature locked", code: "FEATURE_LOCKED", feature: "gstReturns" },
      { status: 402 }
    );
  }

  const { searchParams } = new URL(request.url);
  const fyParam = searchParams.get("fyStartYear");
  const monthParam = searchParams.get("fpMonth");
  const defaults = defaultPeriod();
  const fyStartYear = fyParam ? parseInt(fyParam, 10) : defaults.fyStartYear;
  const fpMonth = monthParam ? parseInt(monthParam, 10) : defaults.fpMonth;

  if (Number.isNaN(fyStartYear) || Number.isNaN(fpMonth) || fpMonth < 1 || fpMonth > 12) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }

  try {
    const json = await buildGstr1Json({ tenantId, fyStartYear, fpMonth });

    // Build a flat display summary from the rich JSON
    const b2bInvoiceCount = json.b2b.reduce((n, c) => n + c.inv.length, 0);
    const b2bTaxable = json.b2b.reduce(
      (s, c) => s + c.inv.reduce((si, inv) => si + inv.itms.reduce((st, it) => st + it.itm_det.txval, 0), 0),
      0
    );
    const b2bTax = json.b2b.reduce(
      (s, c) =>
        s + c.inv.reduce(
          (si, inv) =>
            si + inv.itms.reduce(
              (st, it) => st + it.itm_det.iamt + it.itm_det.camt + it.itm_det.samt,
              0
            ),
          0
        ),
      0
    );

    const b2csTaxable = json.b2cs.reduce((s, r) => s + r.txval, 0);
    const b2csTax = json.b2cs.reduce((s, r) => s + r.iamt + r.camt + r.samt, 0);

    const hsnEntries = json.hsn.data.length;
    const hsnTaxable = json.hsn.data.reduce((s, h) => s + h.txval, 0);

    return NextResponse.json({
      data: {
        fp: json.fp,
        gt: json.gt,
        // B2B summary
        b2b: {
          ctinCount: json.b2b.length,
          invoiceCount: b2bInvoiceCount,
          taxableValue: Math.round(b2bTaxable * 100) / 100,
          tax: Math.round(b2bTax * 100) / 100,
          entries: json.b2b,
        },
        // B2CS summary
        b2cs: {
          rowCount: json.b2cs.length,
          taxableValue: Math.round(b2csTaxable * 100) / 100,
          tax: Math.round(b2csTax * 100) / 100,
          entries: json.b2cs,
        },
        // HSN summary
        hsn: {
          entryCount: hsnEntries,
          taxableValue: Math.round(hsnTaxable * 100) / 100,
          entries: json.hsn.data,
        },
      },
    });
  } catch (error) {
    logError("reports.gstr1.summary.error", {
      requestId: getRequestId(request),
      error,
    });
    return NextResponse.json({ error: "Failed to generate GSTR-1 summary" }, { status: 500 });
  }
}
