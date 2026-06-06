import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/api-tenant";
import { logError, logInfo, getRequestId } from "@/lib/observability";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { checkFeatureAccess } from "@/lib/quota";

export const runtime = "nodejs";

/**
 * Parsed fields extracted from purchase bill OCR text.
 */
export interface OcrParsedFields {
  /** Vendor / supplier name */
  vendor: string | null;
  /** Supplier's invoice / bill number */
  invoiceNo: string | null;
  /** Bill date in YYYY-MM-DD format */
  date: string | null;
  /** Grand total / payable amount (numeric) */
  amount: number | null;
  /** GSTIN of vendor */
  gstin: string | null;
  /** GST tax percentage (e.g. 18 for 18%) */
  taxPercent: number | null;
  /** Confidence score 0-100 from OCR (passed through from client) */
  confidence: number;
}

// ── Regex constants ────────────────────────────────────────────────────────
// NOTE: avoid stateful regexes at module level — they share lastIndex across concurrent requests.
// Create these inside functions or reset lastIndex explicitly (risky in serverless).
const RE_GSTIN = /\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}\b/g;

const RE_INVOICE_NO = /(?:invoice|bill|inv\.?|voucher|receipt)\s*(?:no\.?|number|#|num)\s*[:.\s]*([A-Z0-9\-\/\\]+)/i;

const RE_GST_RATE = /(?:@|gst|igst|cgst\s*\+\s*sgst|tax)\s*@?\s*(\d+(?:\.\d+)?)\s*%/i;

/**
 * Parse an ISO date from DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY formats.
 * Returns YYYY-MM-DD string or null.
 */
function parseIndianDate(raw: string): string | null {
  const m = raw.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (!m) return null;
  const [, day, month, year] = m;
  const d = parseInt(day, 10);
  const mo = parseInt(month, 10);
  let yr = parseInt(year, 10);
  if (yr < 100) yr += yr < 30 ? 2000 : 1900;
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || yr < 2000 || yr > 2099) return null;
  return `${yr}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Extract the most likely bill date from OCR text.
 * Prefers dates near keywords like "Date:", "Invoice Date:", etc.
 * Uses local regex to avoid concurrent request interference.
 */
function extractDate(text: string): string | null {
  // First try: keyword-anchored date
  const keywordDateRe = /(?:invoice\s*date|bill\s*date|date\s*of\s*(?:issue|invoice|bill)|date)[:\s]*([\d]{1,2}[\/\-\.][\d]{1,2}[\/\-\.][\d]{2,4})/i;
  const km = text.match(keywordDateRe);
  if (km) {
    const parsed = parseIndianDate(km[1]);
    if (parsed) return parsed;
  }

  // Fallback: collect all date-like strings and pick the first valid one
  // Local regex to avoid shared lastIndex across concurrent requests
  const reDateLocal = /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/g;
  const all: string[] = [];
  let m;
  while ((m = reDateLocal.exec(text)) !== null) {
    const parsed = parseIndianDate(m[0]);
    if (parsed) all.push(parsed);
  }
  return all[0] ?? null;
}

/**
 * Extract the vendor/supplier name from OCR text.
 *
 * Strategy:
 * 1. Look for "Supplier:", "Vendor:", "Bill From:", "From:" labels.
 * 2. Take the first non-empty line of text that looks like a business name
 *    (≥3 chars, not purely numeric, not a common header keyword).
 */
function extractVendor(text: string): string | null {
  // Strategy 1: explicit label
  const labelRe = /(?:supplier|vendor|bill\s*from|issued?\s*by|from)\s*[:\-]\s*([^\n]{3,60})/i;
  const lm = text.match(labelRe);
  if (lm) return lm[1].trim();

  // Strategy 2: first "significant" line (title-case or mixed-case, ≥3 chars)
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const SKIP_WORDS = /^(invoice|bill|receipt|tax\s*invoice|gst\s*invoice|purchase|proforma|debit|credit|cash\s*memo|original|duplicate|gstin|date|serial|no\.?|#)/i;
  for (const line of lines.slice(0, 10)) {
    if (
      line.length >= 3 &&
      line.length <= 80 &&
      !SKIP_WORDS.test(line) &&
      !/^\d+$/.test(line) && // not purely numeric
      !/^[A-Z0-9]{10,}$/.test(line) // not a GSTIN-like code
    ) {
      return line;
    }
  }
  return null;
}

/**
 * Extract invoice number from OCR text.
 */
function extractInvoiceNo(text: string): string | null {
  const m = text.match(RE_INVOICE_NO);
  if (m) return m[1].trim();

  // Fallback: look for standalone patterns like "INV-2024-001"
  const standalone = text.match(/\b(INV[-\/]\S{3,20}|BILL[-\/]\S{3,20})/i);
  return standalone ? standalone[1].trim() : null;
}

/**
 * Extract the grand total payable amount.
 * Uses local regex to avoid shared lastIndex across concurrent requests.
 */
function extractAmount(text: string): number | null {
  // Primary: "Grand Total", "Net Payable", etc.
  const reTotalPrimary = /(?:grand\s*total|total\s*(?:amount|payable|due|value|charges)?|net\s*(?:payable|amount|total)|amount\s*(?:payable|due)|payable\s*amount)\s*[:\s₹Rs.]*\s*([\d,]+(?:\.\d{1,2})?)/i;
  const m = text.match(reTotalPrimary);
  if (m) {
    const raw = m[1].replace(/,/g, "");
    const n = parseFloat(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  // Fallback: find all "Total X" occurrences, return the largest value
  // (grand total is almost always the largest figure in the document)
  // Local regex to avoid shared lastIndex across concurrent requests
  const reTotalFallback = /total\s*[:\s₹Rs.]*\s*([\d,]+(?:\.\d{1,2})?)/gi;
  const amounts: number[] = [];
  let fm;
  while ((fm = reTotalFallback.exec(text)) !== null) {
    const raw = fm[1].replace(/,/g, "");
    const n = parseFloat(raw);
    if (Number.isFinite(n) && n > 0) amounts.push(n);
  }
  if (amounts.length > 0) return Math.max(...amounts);

  return null;
}

/**
 * Extract GSTIN from text — returns the first match.
 */
function extractGstin(text: string): string | null {
  const matches = text.match(RE_GSTIN);
  return matches?.[0] ?? null;
}

/**
 * Extract GST rate from tax lines.
 */
function extractTaxPercent(text: string): number | null {
  const m = text.match(RE_GST_RATE);
  if (!m) return null;
  const n = parseFloat(m[1]);
  // Common GST rates: 0, 5, 12, 18, 28
  return Number.isFinite(n) && n >= 0 && n <= 28 ? n : null;
}

/**
 * POST /api/ocr/purchase-bill
 *
 * Accepts raw OCR text extracted client-side by Tesseract.js and returns
 * structured fields pre-parsed for the purchase bill form.
 *
 * Body: { text: string; confidence?: number }
 * Returns: { fields: OcrParsedFields }
 *
 * Access: ADMIN and STAFF only.
 */
export async function POST(request: NextRequest) {
  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, role } = sessionResolution.session;

  if (role !== "ADMIN" && role !== "STAFF") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // [Phase 1 — Plan gate] Purchase OCR is a PRO_PLUS feature; enforce server-side.
  const feature = await checkFeatureAccess(tenantId, "purchaseOcr");
  if (!feature.allowed) {
    return NextResponse.json(
      { error: feature.reason ?? "Feature locked", code: "FEATURE_LOCKED", feature: "purchaseOcr" },
      { status: 402 }
    );
  }

  // Rate-limit: max 20 OCR parse requests per minute per tenant
  const rateLimitResponse = await checkRateLimit(request, `ocr-parse:${tenantId}`, 20);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const text = typeof body?.text === "string" ? body.text : "";
    const confidence = typeof body?.confidence === "number" ? body.confidence : 0;

    if (!text.trim()) {
      return NextResponse.json(
        { error: "No OCR text provided" },
        { status: 400 }
      );
    }

    const fields: OcrParsedFields = {
      vendor: extractVendor(text),
      invoiceNo: extractInvoiceNo(text),
      date: extractDate(text),
      amount: extractAmount(text),
      gstin: extractGstin(text),
      taxPercent: extractTaxPercent(text),
      confidence,
    };

    logInfo("ocr.purchase-bill.parsed", {
      requestId: getRequestId(request),
      tenantId,
      confidence,
      fieldsFound: Object.entries(fields)
        .filter(([k, v]) => k !== "confidence" && v !== null)
        .map(([k]) => k),
    });

    return NextResponse.json({ fields });
  } catch (error) {
    logError("ocr.purchase-bill.error", {
      requestId: getRequestId(request),
      error,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
