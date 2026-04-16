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

  // [P2] Pre-flight count guard — large imports exhaust the DB connection pool
  // and cause downstream timeouts. Enforce a 200-voucher cap per API import;
  // larger datasets should use the CLI tool which streams in batches.
  if (vouchers.length > 200) {
    return NextResponse.json(
      {
        error: `Too many vouchers (${vouchers.length}). Max 200 per import. Use the CLI tool for bulk imports.`,
        instruction: "Batch size exceeds UI limits. Please use the HisaabKitaab CLI for bulk imports or split your XML.",
        voucherCount: vouchers.length,
      },
      { status: 413 }
    );
  }

  // ── Party master upsert ───────────────────────────────────────────────────
  let partiesCreated = 0;

  // [B2] Use upsert with the new @@unique([tenantId, name]) constraint.
  // The unique constraint is the authoritative race guard — no concurrent
  // import can create duplicate party rows even if the cache misses.
  const partyCache = new Map<string, string>();

  for (const pm of partyMasters) {
    const upserted = await prisma.party.upsert({
      where: { tenantId_name: { tenantId: tid, name: pm.name } },
      update: {}, // party exists — do not overwrite balances set by user
      create: {
        tenantId: tid,
        name: pm.name,
        type: pm.group === "Sundry Debtors" ? "CUSTOMER" : "VENDOR",
        openingBalance: pm.openingBalance,
        currentBalance: pm.openingBalance,
        createdBy: actorId,
      },
      select: { id: true, createdAt: true, updatedAt: true },
    });
    // Count as created only when createdAt === updatedAt (i.e., just INSERTed)
    if (upserted.createdAt.getTime() === upserted.updatedAt.getTime()) {
      partiesCreated++;
    }
    partyCache.set(pm.name, upserted.id);
  }

  // ── Voucher import ────────────────────────────────────────────────────────

  /**
   * Resolve party name → partyId using the pre-warmed cache.
   * Called OUTSIDE per-voucher transactions so no DB round-trip is made
   * inside any open transaction (prevents connection pool exhaustion on
   * large bulk imports).
   * [FIX-P1] replaces the previous tx-scoped resolvePartyId.
   */
  async function resolvePartyId(
    name: string,
    accountCode: AccountCode
  ): Promise<string> {
    const cached = partyCache.get(name);
    if (cached) return cached;

    // Upsert via prisma (not tx) — @@unique([tenantId, name]) is the race guard.
    const partyType =
      accountCode === "SUNDRY_DEBTORS" ? "CUSTOMER" : "VENDOR";
    const upserted = await prisma.party.upsert({
      where: { tenantId_name: { tenantId: tid, name } },
      update: {},
      create: {
        tenantId: tid,
        name,
        type: partyType,
        openingBalance: 0,
        currentBalance: 0,
        createdBy: actorId,
      },
      select: { id: true, createdAt: true, updatedAt: true },
    });
    if (upserted.createdAt.getTime() === upserted.updatedAt.getTime()) {
      partiesCreated++;
    }
    partyCache.set(name, upserted.id);
    return upserted.id;
  }

  // [FIX-P1] Pre-warm party cache for ALL unique party names across ALL vouchers
  // before any per-voucher transactions begin.  This ensures resolvePartyId
  // never needs a DB call inside an open transaction.
  const allPartyNames = [
    ...new Set(
      vouchers
        .flatMap((v) => v.lines.map((l) => l.partyName))
        .filter((n): n is string => !!n)
    ),
  ];
  await Promise.all(
    allPartyNames
      .filter((name) => !partyCache.has(name))
      .map((name) => resolvePartyId(name, "SUNDRY_DEBTORS")) // group inferred inside resolvePartyId
  );

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  const importErrors: string[] = [];

  // [FIX-P0] Primary dedup key: voucher.remoteId stored in JournalEntry.remoteId.
  // The @@unique([tenantId, remoteId]) DB constraint is the atomic guard —
  // concurrent imports of the same XML both attempt the insert; only one
  // succeeds, the other gets a unique-constraint violation (counted as "skipped").
  //
  // Fallback fingerprint for vouchers without REMOTEID (native old-format
  // Tally exports or hand-typed XML): unchanged pre-fetch approach.
  const vouchersWithRemoteId = vouchers.filter((v) => v.remoteId);
  const vouchersWithoutRemoteId = vouchers.filter((v) => !v.remoteId);

  // Build fingerprint set only for the no-remoteId subset to avoid N+1.
  let duplicateFingerprints = new Set<string>();
  if (vouchersWithoutRemoteId.length > 0) {
    const dates = vouchersWithoutRemoteId.map((v) => v.entryDate.getTime());
    const rangeMin = new Date(Math.min(...dates));
    const rangeMax = new Date(Math.max(...dates));
    const existingEntries = await prisma.journalEntry.findMany({
      where: {
        tenantId: tid,
        entryDate: { gte: rangeMin, lte: rangeMax },
        remoteId: null, // only un-tagged entries participate in fingerprint dedup
      },
      select: { voucherType: true, entryDate: true, narration: true, totalDebit: true },
    });
    duplicateFingerprints = new Set(
      existingEntries.map(
        (e: (typeof existingEntries)[number]) =>
          `${e.voucherType}|${e.entryDate.toISOString()}|${e.narration}|${e.totalDebit.toString()}`
      )
    );
  }

  // Import vouchers in parallel batches of 25.
  // Each voucher has its own transaction for per-voucher fault isolation.
  const BATCH_SIZE = 25;

  async function importVoucher(
    voucher: (typeof vouchers)[number]
  ): Promise<"imported" | "skipped" | Error> {
    // ── Fingerprint dedup (vouchers without remoteId only) ─────────────────
    if (!voucher.remoteId) {
      const fingerprint = `${voucher.voucherType}|${voucher.entryDate.toISOString()}|${voucher.narration}|${String(voucher.totalDebit)}`;
      if (duplicateFingerprints.has(fingerprint)) {
        return "skipped";
      }
    }

    try {
      // Build resolved lines BEFORE opening the transaction — partyCache is
      // fully warm so no DB calls are needed inside the tx.
      const lines = await Promise.all(
        voucher.lines.map(async (line) => {
          const partyId = line.partyName
            ? await resolvePartyId(line.partyName, line.accountCode)
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

      await prisma.$transaction(async (tx: PrismaTx) => {
        await createJournalEntry(tx, {
          tenantId: tid,
          entryDate: voucher.entryDate,
          narration: voucher.narration,
          voucherType: voucher.voucherType,
          createdBy: actorId,
          // [FIX-P0] Store remoteId so @@unique constraint prevents re-import
          ...(voucher.remoteId ? { remoteId: voucher.remoteId } : {}),
          lines,
        });
      }, { timeout: 8000 }); // [P2] 8s cap prevents long-running import tx from blocking the pool
      return "imported";
    } catch (err: unknown) {
      // Unique constraint violation on (tenantId, remoteId) → already imported
      const msg =
        err instanceof Error ? err.message : String(err);
      if (msg.includes("Unique constraint") && voucher.remoteId) {
        return "skipped";
      }
      return err instanceof Error ? err : new Error(msg);
    }
  }

  const allVouchers = [...vouchersWithRemoteId, ...vouchersWithoutRemoteId];
  for (let i = 0; i < allVouchers.length; i += BATCH_SIZE) {
    const batch = allVouchers.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(importVoucher));

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === "rejected") {
        failed++;
        importErrors.push(
          `Voucher "${batch[j].reference}" (${batch[j].voucherType}): unexpected rejection`
        );
      } else if (result.value === "skipped") {
        skipped++;
      } else if (result.value === "imported") {
        imported++;
      } else {
        failed++;
        importErrors.push(
          `Voucher "${batch[j].reference}" (${batch[j].voucherType}): ${result.value.message}`
        );
      }
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
