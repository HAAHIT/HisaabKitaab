import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSession } from "@/lib/api-tenant";
import { logError, logInfo, getRequestId } from "@/lib/observability";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { parseTallyXml } from "@/lib/tally-xml-import";
import { processImportJob } from "@/app/api/jobs/process-import/route";
import { gzipSync } from "zlib";

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

  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, userId, role } = sessionResolution.session;

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    // [M-4] Tally ERP 9 exports XML in UTF-16 LE with BOM. Blob.text() assumes
    // UTF-8 and will produce mojibake. Use TextDecoder with BOM sniffing instead.
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    const hasUtf16LeBom = uint8[0] === 0xFF && uint8[1] === 0xFE;
    const hasUtf16BeBom = uint8[0] === 0xFE && uint8[1] === 0xFF;
    const encoding = hasUtf16LeBom ? "utf-16le" : hasUtf16BeBom ? "utf-16be" : "utf-8";
    xmlText = new TextDecoder(encoding).decode(arrayBuffer);
  } catch (err) {
    logError("import.tally-xml.read-error", {
      requestId: getRequestId(request),
      error: err,
    });
    return NextResponse.json({ error: "Failed to read uploaded file" }, { status: 400 });
  }

  // Parse upfront to get accurate totalItems for progress tracking
  let totalItems = 0;
  let parseErrors: string[] = [];
  try {
    const parsed = parseTallyXml(xmlText);
    totalItems = parsed.vouchers.length;
    parseErrors = parsed.parseErrors ?? [];
  } catch {
    // Non-fatal — job will re-parse and fail gracefully if truly broken
  }

  // [S-W1] Compress XML before DB storage (~80% size reduction).
  // Prefix with "gzip:" so the process-import route can detect and decompress.
  const compressedXml = "gzip:" + gzipSync(Buffer.from(xmlText, "utf-8")).toString("base64");

  // Create the tracking job
  // [M-5] Set createdBy so the audit trail records which admin triggered the import.
  const job = await prisma.importJob.create({
    data: {
      tenantId: tid,
      totalItems,
      xmlData: compressedXml,
      status: "PENDING",
      createdBy: actorId,
    }
  });

  logInfo("import.tally-xml.queued", {
    requestId: getRequestId(request),
    tenantId: tid,
    jobId: job.id,
    totalItems,
  });

  // Fire-and-forget — do not await, response returns immediately
  processImportJob(job.id).catch((err) =>
    logError("import.tally-xml.trigger-error", { jobId: job.id, error: err })
  );

  return NextResponse.json({
    jobId: job.id,
    message: "Import job queued successfully.",
    totalDetected: totalItems,
    parseErrors,
  });
}
