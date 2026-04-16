import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveWriteTenant } from "@/lib/api-tenant";
import { logError, logInfo, getRequestId } from "@/lib/observability";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { parseTallyXml } from "@/lib/tally-xml-import";
import { createJournalEntry } from "@/lib/journal";
import type { AccountCode } from "@/lib/chart-of-accounts";

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

  // ── Parse ─────────────────────────────────────────────────────────────────
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

  // ── Party master upsert ───────────────────────────────────────────────────
  let partiesCreated = 0;

  // Pre-fetch all existing parties for this tenant to avoid loop queries
  const existingParties = await prisma.party.findMany({
    where: { tenantId: tid, isDeleted: false },
    select: { id: true, name: true },
  });

  // Build party name → id cache to avoid repeated DB lookups
  const partyCache = new Map<string, string>();
  for (const p of existingParties) {
    partyCache.set(p.name, p.id);
  }

  for (const pm of partyMasters) {
    if (partyCache.has(pm.name)) continue;

    const created = await prisma.party.create({
      data: {
        tenantId: tid,
        name: pm.name,
        type: pm.group === "Sundry Debtors" ? "CUSTOMER" : "VENDOR",
        openingBalance: pm.openingBalance,
        currentBalance: pm.openingBalance,
        createdBy: actorId,
      },
      select: { id: true }
    });
    partyCache.set(pm.name, created.id);
    partiesCreated++;
  }

  // ── Voucher import ────────────────────────────────────────────────────────

  async function resolvePartyId(
    tx: Omit<
      import("@prisma/client").PrismaClient,
      "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
    >,
    name: string,
    accountCode: AccountCode
  ): Promise<string> {
    const cached = partyCache.get(name);
    if (cached) return cached;

    // Create new party (already know it doesn't exist from cache)
    const partyType =
      accountCode === "SUNDRY_DEBTORS" ? "CUSTOMER" : "VENDOR";
    const created = await tx.party.create({
      data: {
        tenantId: tid,
        name,
        type: partyType,
        openingBalance: 0,
        currentBalance: 0,
        createdBy: actorId,
      },
      select: { id: true },
    });
    partiesCreated++;

    partyCache.set(name, created.id);
    return created.id;
  }

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  const importErrors: string[] = [];

  // Pre-fetch all existing journal entries in the date range of this import
  // to avoid one DB query per voucher (N+1). Build an in-memory fingerprint
  // Set and check against it inside the loop.
  const voucherDates = vouchers.map((v) => v.entryDate.getTime());
  const rangeMin = new Date(Math.min(...voucherDates));
  const rangeMax = new Date(Math.max(...voucherDates));

  const existingEntries = await prisma.journalEntry.findMany({
    where: {
      tenantId: tid,
      entryDate: { gte: rangeMin, lte: rangeMax },
    },
    select: { voucherType: true, entryDate: true, narration: true, totalDebit: true },
  });

  const duplicateFingerprints = new Set(
    existingEntries.map(
      (e) => `${e.voucherType}|${e.entryDate.toISOString()}|${e.narration}|${String(e.totalDebit)}`
    )
  );

  for (const voucher of vouchers) {
    // Duplicate detection against the pre-fetched fingerprint set — O(1), no DB round-trip.
    const fingerprint = `${voucher.voucherType}|${voucher.entryDate.toISOString()}|${voucher.narration}|${String(voucher.totalDebit)}`;
    if (duplicateFingerprints.has(fingerprint)) {
      skipped++;
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        const lines = await Promise.all(
          voucher.lines.map(async (line) => {
            const partyId = line.partyName
              ? await resolvePartyId(tx, line.partyName, line.accountCode)
              : null;

            return {
              accountCode: line.accountCode,
              debit: line.debit,
              credit: line.credit,
              partyId,
              partyName: line.partyName ?? undefined,
            };
          })
        );

        await createJournalEntry(tx, {
          tenantId: tid,
          entryDate: voucher.entryDate,
          narration: voucher.narration,
          voucherType: voucher.voucherType,
          createdBy: actorId,
          lines,
        });
      });

      imported++;
    } catch (err) {
      failed++;
      importErrors.push(
        `Voucher "${voucher.reference}" (${voucher.voucherType}): ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  logInfo("import.tally-xml.complete", {
    requestId: getRequestId(request),
    tenantId,
    partiesCreated,
    imported,
    skipped,
    failed,
  });

  return NextResponse.json({
    partiesCreated,
    imported,
    skipped,
    failed,
    parseErrors,
    importErrors,
  });
}
