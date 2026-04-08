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
 * Import Tally ERP XML from a multipart/form-data upload and create corresponding
 * Party and JournalEntry records for the resolved tenant.
 *
 * Expects a multipart/form-data request with a `file` field containing Tally XML.
 * Only requests from users with role `ADMIN` are accepted. The handler enforces
 * per-tenant rate limits and a maximum upload size (5 MB). It parses party
 * masters and vouchers from the XML, upserts missing parties, and imports
 * vouchers as journal entries. Duplicate vouchers are skipped using the tuple
 * (voucherType, entryDate, narration, totalDebit).
 *
 * @returns An object containing:
 *  - `partiesCreated`: number of Party records created
 *  - `imported`: number of vouchers successfully imported
 *  - `skipped`: number of vouchers skipped as duplicates
 *  - `failed`: number of vouchers that failed to import
 *  - `parseErrors`: array of parsing error messages from XML processing
 *  - `importErrors`: array of per-voucher error messages for failed imports
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
  for (const pm of partyMasters) {
    const existing = await prisma.party.findFirst({
      where: { tenantId: tid, name: pm.name, isDeleted: false },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.party.create({
      data: {
        tenantId: tid,
        name: pm.name,
        type: pm.group === "Sundry Debtors" ? "CUSTOMER" : "VENDOR",
        openingBalance: pm.openingBalance,
        currentBalance: pm.openingBalance,
        createdBy: actorId,
      },
    });
    partiesCreated++;
  }

  // ── Voucher import ────────────────────────────────────────────────────────
  // Build party name → id cache to avoid repeated DB lookups
  const partyCache = new Map<string, string>();

  /**
   * Resolve a party name to its party ID, creating and caching a new Party if none exists.
   *
   * Looks up a non-deleted Party by exact `name` for the current tenant and returns its `id`.
   * If not found, creates a new Party with `type` set to `"CUSTOMER"` when `accountCode` is
   * `"SUNDRY_DEBTORS"` and `"VENDOR"` otherwise (opening and current balances set to 0),
   * increments `partiesCreated`, caches the name→id mapping, and returns the new `id`.
   *
   * @param name - The exact party name to resolve or create
   * @param accountCode - Account code used to determine the party `type` when creating
   * @returns The resolved or newly created party `id`
   */
  async function resolvePartyId(
    name: string,
    accountCode: AccountCode
  ): Promise<string> {
    const cached = partyCache.get(name);
    if (cached) return cached;

    // Exact name match first
    const existing = await prisma.party.findFirst({
      where: { tenantId: tid, name, isDeleted: false },
      select: { id: true },
    });

    if (existing) {
      partyCache.set(name, existing.id);
      return existing.id;
    }

    // Create new party
    const partyType =
      accountCode === "SUNDRY_DEBTORS" ? "CUSTOMER" : "VENDOR";
    const created = await prisma.party.create({
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

  for (const voucher of vouchers) {
    // Duplicate detection: (voucherType, entryDate, narration, totalDebit)
    const duplicate = await prisma.journalEntry.findFirst({
      where: {
        tenantId: tid,
        voucherType: voucher.voucherType,
        entryDate: voucher.entryDate,
        narration: voucher.narration,
        totalDebit: voucher.totalDebit,
      },
      select: { id: true },
    });

    if (duplicate) {
      skipped++;
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
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
