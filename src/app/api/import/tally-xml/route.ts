import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveWriteSession } from "@/lib/api-tenant";
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



  // [FIX] Use JWT-verified session instead of trusting proxy headers
  const sessionResolution = await resolveWriteSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId: tid, userId: sessionUserId, role: sessionRole } = sessionResolution.session;

  if (sessionRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let xmlText: string;
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    const fileSize = file.size;
    if (fileSize > MAX_BYTES) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_BYTES / 1024 / 1024} MB)` },
        { status: 413 }
      );
    }

    // Native Tally ERP 9 exports are often UTF-16 LE encoded.
    // Blob.text() always decodes as UTF-8, producing garbled output for UTF-16.
    // Detect encoding via BOM and use the correct TextDecoder.
    const rawBuffer = await file.arrayBuffer();
    const rawBytes = new Uint8Array(rawBuffer);

    if (rawBytes[0] === 0xFF && rawBytes[1] === 0xFE) {
      // UTF-16 LE BOM
      xmlText = new TextDecoder("utf-16le").decode(rawBytes);
    } else if (rawBytes[0] === 0xFE && rawBytes[1] === 0xFF) {
      // UTF-16 BE BOM
      xmlText = new TextDecoder("utf-16be").decode(rawBytes);
    } else {
      // Default: UTF-8 (handles BOM-less UTF-8 and UTF-8 with BOM)
      xmlText = new TextDecoder("utf-8").decode(rawBytes);
    }
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
      createdBy: sessionUserId,
      totalItems: totalItems,
      xmlData: compressedXml,
      status: "PENDING",
    }
  });

  logInfo("import.tally-xml.queued", {
    requestId: getRequestId(request),
    tenantId: tid,
    jobId: job.id,
    totalItems,
  });

  const processResponse = await processImportJob(job.id);
  const processPayload = await processResponse.json().catch(() => null);

  if (!processResponse.ok) {
    return NextResponse.json(
      {
        jobId: job.id,
        error: processPayload?.error || "Import job failed.",
        parseErrors: upfrontErrors,
      },
      { status: processResponse.status }
    );
  }

  if (processPayload && typeof processPayload.imported === "number") {
    return NextResponse.json({
      ...processPayload,
      totalDetected: processPayload.totalItems ?? totalItems,
      parseErrors: Array.from(new Set([...upfrontErrors, ...(processPayload.parseErrors ?? [])])),
      importErrors: [],
    });
  }

  return NextResponse.json({
    jobId: job.id,
    status: processPayload?.status ?? "PENDING",
    message: processPayload?.message ?? "Import job queued successfully.",
    totalDetected: totalItems,
    parseErrors: upfrontErrors,
  });
}
