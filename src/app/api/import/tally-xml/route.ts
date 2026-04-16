import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveWriteTenant } from "@/lib/api-tenant";
import { logError, logInfo, getRequestId } from "@/lib/observability";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { parseTallyXml } from "@/lib/tally-xml-import";
import { createJournalEntry } from "@/lib/journal";
import type { AccountCode } from "@/lib/chart-of-accounts";

// Derive Prisma tx type from the client instance to avoid the
// @prisma/client → .prisma/client re-export failure under Prisma v7.
type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export const runtime = "nodejs";

// Max 5 imports per minute per tenant
const RATE_LIMIT_KEY = "import.tally-xml";
const RATE_LIMIT_COUNT = 5;

// 5 MB max XML size
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * POST /api/import/tally-xml
 *
 * Body: multipart/form-data with field `file` (XML text)
 *
 * Parses a Tally ERP 9 / Tally Prime XML export and commits:
 *   - Party masters → upserted as Party records
 *   - Vouchers     → JournalEntry + JournalLine records
 *
 * Duplicate detection: (voucherType, entryDate, narration, totalDebit)
 * Access: ADMIN only
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await checkRateLimit(
    request,
    RATE_LIMIT_KEY,
    RATE_LIMIT_COUNT
  );
  if (rateLimitResponse) return rateLimitResponse;

  const role = request.headers.get("x-user-role");
  const userId = request.headers.get("x-user-id");

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const tenantResolution = await resolveWriteTenant(request);
  if (!tenantResolution.ok) {
    return tenantResolution.response;
  }
  const tenantId = tenantResolution.tenantId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const actorId: string = userId;
  const tid: string = tenantId;

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
    logError("import.tally-xml.read-error", {
      requestId: getRequestId(request),
      error: err,
    });
    return NextResponse.json({ error: "Failed to read uploaded file" }, { status: 400 });
  }

  // ── Parse quickly to get counts ──────────────────────────────────────────
  const { vouchers, partyMasters, parseErrors } = parseTallyXml(xmlText);

  if (vouchers.length === 0 && partyMasters.length === 0) {
    return NextResponse.json(
      {
        error: "No importable data found in XML",
        parseErrors,
      },
      { status: 422 }
    );
  }

  // Create the tracking job
  const job = await prisma.importJob.create({
    data: {
      tenantId: tid,
      totalItems: vouchers.length + partyMasters.length,
      xmlData: xmlText,
      status: "PENDING",
    }
  });

  logInfo("import.tally-xml.queued", {
    requestId: getRequestId(request),
    tenantId: tid,
    jobId: job.id,
    vouchersParsed: vouchers.length,
    mastersParsed: partyMasters.length,
  });

  return NextResponse.json({
    jobId: job.id,
    message: "Import job queued successfully.",
    totalDetected: vouchers.length + partyMasters.length,
    parseErrors,
  });
}
