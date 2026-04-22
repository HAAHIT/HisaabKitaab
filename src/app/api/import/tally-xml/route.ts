import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveWriteTenant } from "@/lib/api-tenant";
import { logError, logInfo, getRequestId } from "@/lib/observability";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { parseTallyXml } from "@/lib/tally-xml-import";
import { createJournalEntry } from "@/lib/journal";
import { gzipSync } from "zlib";
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

  // [S-W1] Compress XML before DB storage (~80% size reduction).
  // Prefix with "gzip:" so the process-import route can detect and decompress.
  const compressedXml = "gzip:" + gzipSync(Buffer.from(xmlText, "utf-8")).toString("base64");

  // Determine total items up front so the UI doesn't show "0 of 0"
  let totalItems = 0;
  let upfrontErrors: string[] = [];
  try {
    const parsed = parseTallyXml(xmlText);
    totalItems = parsed.vouchers.length;
    upfrontErrors = parsed.parseErrors;
  } catch (err) {
    console.error("Failed to parse Tally XML for total item count", err);
    upfrontErrors.push(err instanceof Error ? err.message : String(err));
  }

  // Create the tracking job
  const job = await prisma.importJob.create({
    data: {
      tenantId: tid,
      totalItems: totalItems,
      xmlData: compressedXml,
      status: "PENDING",
    }
  });

  // Trigger background job (fire-and-forget for local dev where Vercel cron isn't running)
  try {
    const processUrl = new URL("/api/jobs/process-import", request.url);
    fetch(processUrl.toString(), {
      method: "GET",
      headers: {
        "x-cron-secret": process.env.CRON_SECRET || "",
      },
    }).catch((e) => console.error("Fire-and-forget process-import failed:", e));
  } catch (err) {
    console.error("Failed to construct process-import URL:", err);
  }

  logInfo("import.tally-xml.queued", {
    requestId: getRequestId(request),
    tenantId: tid,
    jobId: job.id,
    totalItems,
  });

  return NextResponse.json({
    jobId: job.id,
    message: totalItems > 0 ? "Import job queued successfully." : "No vouchers detected in XML.",
    totalDetected: totalItems,
    parseErrors: upfrontErrors,
  });
}
