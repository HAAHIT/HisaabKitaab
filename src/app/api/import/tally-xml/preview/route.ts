import { NextRequest, NextResponse } from "next/server";
import { resolveReadTenant } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";
import { parseTallyXml } from "@/lib/tally-xml-import";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const role = request.headers.get("x-user-role");

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const tenantResolution = await resolveReadTenant(request);
  if (!tenantResolution.ok) {
    return tenantResolution.response;
  }

  let xmlText: string;
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    const bytes = file.size;
    if (bytes > MAX_BYTES) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_BYTES / 1024 / 1024} MB)` },
        { status: 413 }
      );
    }
    xmlText = await file.text();
  } catch (err) {
    logError("import.tally-xml.preview.read-error", {
      requestId: getRequestId(request),
      error: err,
    });
    return NextResponse.json({ error: "Failed to read uploaded file" }, { status: 400 });
  }

  try {
    const result = parseTallyXml(xmlText);

    // Group vouchers by type
    const salesCount = result.vouchers.filter(v => v.voucherType === "SALES").length;
    const purchasesCount = result.vouchers.filter(v => v.voucherType === "PURCHASE").length;
    const receiptsCount = result.vouchers.filter(v => v.voucherType === "RECEIPT").length;
    const paymentsCount = result.vouchers.filter(v => v.voucherType === "PAYMENT").length;
    const journalsCount = result.vouchers.filter(v => v.voucherType === "JOURNAL").length;

    return NextResponse.json({
      vouchersCount: result.vouchers.length,
      partiesCount: result.partyMasters.length,
      salesCount,
      purchasesCount,
      receiptsCount,
      paymentsCount,
      journalsCount,
      parseErrors: result.parseErrors,
    });
  } catch (error) {
    logError("import.tally-xml.preview.parse-error", {
      requestId: getRequestId(request),
      error,
    });
    return NextResponse.json({ error: "Internal server error during XML parsing" }, { status: 500 });
  }
}
