import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseTallyXml } from "@/lib/tally-xml-import";
import { createJournalEntry } from "@/lib/journal";
import { recomputePartyBalance } from "@/lib/party-balance.server";
import { logError } from "@/lib/observability";
import { gunzipSync } from "zlib";
import crypto from "crypto";
import type { AccountCode } from "@/lib/chart-of-accounts";

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// ── Voucher type resolver ─────────────────────────────────────────────────────
// Maps native Tally return-type strings to our internal VoucherType enum.
// Without this, "Sales Return" imports get stored as SALES, which excludes
// them from recomputePartyBalance (which queries CREDIT_NOTE/DEBIT_NOTE)
// and causes GSTR-1 Table 9B under-reporting on re-export.
type VoucherType =
  | "SALES"
  | "PURCHASE"
  | "RECEIPT"
  | "PAYMENT"
  | "JOURNAL"
  | "CREDIT_NOTE"
  | "DEBIT_NOTE"
  | "CONTRA";

export function resolveImportVoucherType(
  originalTypeName: string,
  baseType: string
): VoucherType {
  // [FIX] Case-insensitive comparison — Tally versions emit varying casing
  // e.g. "Sales Return", "SALES RETURN", "sales return".
  const normalized = originalTypeName.trim().toUpperCase();
  if (normalized === "SALES RETURN" || normalized === "CREDIT NOTE")
    return "CREDIT_NOTE";
  if (normalized === "PURCHASE RETURN" || normalized === "DEBIT NOTE")
    return "DEBIT_NOTE";
  // [X4] Preserve Contra voucher type instead of collapsing to JOURNAL
  if (normalized === "CONTRA") return "CONTRA";
  return baseType as VoucherType;
}

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  // ── Auth: require CRON_SECRET header ───────────────────────────────────────
  const cronSecret = request.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return processImportJob();
}

export async function processImportJob(jobId?: string) {

  // ── Atomic job claim ────────────────────────────────────────────────────────
  // Two-step: find oldest PENDING job, then atomically update only if it is
  // still PENDING. If two cron workers race, only one will see count=1.
  const candidate = jobId
    ? await prisma.importJob.findFirst({
      where: { id: jobId, status: "PENDING" },
    })
    : await prisma.importJob.findFirst({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
    });

  if (!candidate) {
    return NextResponse.json({
      status: "IDLE",
      message: jobId ? "Job is not pending" : "No pending jobs",
    });
  }

  const claimed = await prisma.importJob.updateMany({
    where: { id: candidate.id, status: "PENDING" },
    data: { status: "PROCESSING" },
  });

  if (claimed.count === 0) {
    // Another worker already claimed this job between our findFirst and updateMany
    return NextResponse.json({
      jobId: candidate.id,
      status: "PROCESSING",
      message: "Job already claimed by another worker",
    });
  }

  const job = candidate;

  const tenantLockKey = BigInt(
    "0x" + crypto.createHash("sha256").update(job.tenantId).digest("hex").substring(0, 15)
  );

  // [W1-FIX] Track whether the session-level advisory lock was acquired so
  // the finally block only attempts to unlock when necessary.
  let lockAcquired = false;

  try {
    const tid = job.tenantId;
    // Use the uploading user's ID for Bill.createdBy (FK to User table).
    // Fall back to "system" only for non-FK fields (JournalEntry, AuditLog, BillTemplate).
    const billCreatorId = job.createdBy ?? "system";
    const actorId = job.createdBy ?? "system";

    // [S-W1] Decompress if stored with gzip prefix (backwards-compatible with raw XML)
    let xmlText = job.xmlData;
    if (xmlText.startsWith("gzip:")) {
      const compressed = Buffer.from(xmlText.slice(5), "base64");
      xmlText = gunzipSync(compressed).toString("utf-8");
    }

    const { vouchers, partyMasters, parseErrors } = parseTallyXml(xmlText);

    if (parseErrors.length > 0 && vouchers.length === 0 && partyMasters.length === 0) {
      throw new Error(parseErrors.join("; "));
    }

    await prisma.importJob.update({
      where: { id: job.id },
      data: { totalItems: vouchers.length },
    });

    const needsTallyTemplate = vouchers.some(
      (voucher) =>
        voucher.inventoryRows &&
        voucher.inventoryRows.length > 0 &&
        (voucher.voucherType === "SALES" || voucher.voucherType === "PURCHASE")
    );

    // [P1] Resolve/Create template for Tally imports only when inventory rows
    // need to be saved. This avoids creating a hidden template for ledger-only XML.
    let tallyTemplateId: string | null = null;
    if (needsTallyTemplate) {
      const existingTallyTemplate = await prisma.billTemplate.findFirst({
        where: { name: "__TALLY_IMPORT__", tenantId: tid },
        select: { id: true },
      });
      if (existingTallyTemplate) {
        tallyTemplateId = existingTallyTemplate.id;
      } else {
        // If not found, create a minimalist template that includes common Tally columns
        const fallbackTemplate = await prisma.billTemplate.create({
          data: {
            tenantId: tid,
            name: "__TALLY_IMPORT__",
            columns: [
              { id: "Item", name: "Item", type: "text", position: 0 },
              { id: "Qty", name: "Qty", type: "number", position: 1 },
              { id: "Unit", name: "Unit", type: "text", position: 2 },
              { id: "Rate", name: "Rate", type: "number", position: 3 },
              { id: "Amount", name: "Amount", type: "number", position: 4 },
            ],
            createdBy: actorId,
          },
        });
        tallyTemplateId = fallbackTemplate.id;
      }
    }

    let partiesCreated = 0;
    const partyCache = new Map<string, string>();

    for (const pm of partyMasters) {
      const upserted = await prisma.party.upsert({
        where: { tenantId_name: { tenantId: tid, name: pm.name } },
        // [W-X3] Fill in GSTIN/address only when existing record has null values
        update: {
          ...(pm.gstin ? { gstin: { set: pm.gstin } } : {}),
          ...(pm.address ? { address: { set: pm.address } } : {}),
        },
        create: {
          tenantId: tid,
          name: pm.name,
          type: pm.group === "Sundry Debtors" ? "CUSTOMER" : "VENDOR",
          openingBalance: pm.openingBalance,
          currentBalance: pm.openingBalance,
          gstin: pm.gstin,
          address: pm.address,
          createdBy: actorId,
        },
        select: { id: true, createdAt: true, updatedAt: true },
      });
      if (upserted.createdAt.getTime() === upserted.updatedAt.getTime()) {
        partiesCreated++;
        // [I3] Audit trail for import-created parties (MCA GSR 247(E)).
        await prisma.auditLog.create({
          data: {
            tenantId: tid,
            entityType: "Party",
            entityId: upserted.id,
            userId: null,
            actorType: "SYSTEM",
            action: "CREATE",
            newValue: JSON.stringify({
              source: "tally-import",
              jobId: job.id,
              partyName: pm.name,
              group: pm.group,
            }),
          },
        });
      }
      partyCache.set(pm.name, upserted.id);
    }

    async function resolvePartyId(
      name: string,
      accountCode: AccountCode
    ): Promise<string> {
      const cached = partyCache.get(name);
      if (cached) return cached;
      const partyType = accountCode === "SUNDRY_DEBTORS" ? "CUSTOMER" : "VENDOR";
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

    // [S2] Batch party pre-resolution — chunks of 25 to reduce lock contention
    // compared to the previous Promise.all that fired all upserts in parallel.
    const partyAccountCodes = new Map<string, AccountCode>();
    for (const voucher of vouchers) {
      for (const line of voucher.lines) {
        if (line.partyName && !partyCache.has(line.partyName) && !partyAccountCodes.has(line.partyName)) {
          partyAccountCodes.set(line.partyName, line.accountCode);
        }
      }
    }

    const allPartyEntries = [...partyAccountCodes.entries()];

    const PARTY_BATCH = 25;
    for (let i = 0; i < allPartyEntries.length; i += PARTY_BATCH) {
      const batch = allPartyEntries.slice(i, i + PARTY_BATCH);
      await Promise.all(
        batch.map(([name, accountCode]) => resolvePartyId(name, accountCode))
      );
    }

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    const vouchersWithRemoteId = vouchers.filter((v) => v.remoteId);
    const vouchersWithoutRemoteId = vouchers.filter((v) => !v.remoteId);

    let duplicateFingerprints = new Set<string>();

    // [W1-FIX] Non-blocking advisory lock — prevents indefinite hangs when a
    // previous import leaked a session-level lock (e.g. process crash, serverless
    // timeout). pg_try_advisory_lock returns false immediately if already held,
    // instead of blocking forever like pg_advisory_lock.
    const lockResult: { acquired: boolean }[] =
      await prisma.$queryRaw`SELECT pg_try_advisory_lock(${tenantLockKey}) as acquired`;
    lockAcquired = lockResult[0]?.acquired === true;

    if (!lockAcquired) {
      // Another import is already running (or a leaked lock exists).
      // Revert claim so the next cron cycle retries this job.
      await prisma.importJob.update({
        where: { id: job.id },
        data: { status: "PENDING" },
      });
      return NextResponse.json({
        jobId: job.id,
        status: "PENDING",
        message: "Import already in progress for this tenant, will retry",
      });
    }

    if (vouchersWithoutRemoteId.length > 0) {
      // [S3] DB-side duplicate check: query only fingerprint strings instead of
      // loading entire JournalEntry rows into memory. Uses raw SQL for
      // string concatenation to keep the comparison server-side.
      const dates = vouchersWithoutRemoteId.map((v) => v.entryDate.getTime());
      const rangeMin = new Date(Math.min(...dates));
      const rangeMax = new Date(Math.max(...dates));
      // [FIX] Cast totalDebit via float8 to strip DECIMAL(19,4) trailing zeros
      // (e.g. "100.0000" → "100") so it matches JS String(number) output.
      const existingFingerprints: { fp: string }[] = await prisma.$queryRaw`
        SELECT CONCAT(
          "voucherType", '|',
          TO_CHAR("entryDate" AT TIME ZONE 'UTC', 'YYYY-MM-DD'), '|',
          COALESCE("narration", ''), '|',
          "totalDebit"::float8::text
        ) as fp
        FROM "JournalEntry"
        WHERE "tenantId" = ${tid}
          AND "entryDate" >= ${rangeMin}
          AND "entryDate" <= ${rangeMax}
          AND "remoteId" IS NULL
      `;
      duplicateFingerprints = new Set(
        existingFingerprints.map((r) => r.fp)
      );
    }

    const BATCH_SIZE = 50;

    async function importVoucher(
      voucher: (typeof vouchers)[number]
    ): Promise<"imported" | "skipped" | Error> {
      if (!voucher.remoteId) {
        // Use date string only (YYYY-MM-DD) for fingerprint — avoids IST/UTC
        // mismatch where Tally's YYYYMMDD date becomes the previous day in UTC.
        const dateStr = voucher.entryDate.toISOString().slice(0, 10);
        // [FIX] Use the *resolved* voucherType (e.g. CREDIT_NOTE) to match
        // the DB-side fingerprint, not the raw parser type (e.g. SALES).
        const resolvedType = resolveImportVoucherType(
          voucher.originalTypeName,
          voucher.voucherType
        );
        const fingerprint = `${resolvedType}|${dateStr}|${voucher.narration}|${String(voucher.totalDebit)}`;
        if (duplicateFingerprints.has(fingerprint)) {
          return "skipped";
        }
      }

      try {
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

        // ── Auto-adjust rounding for Tally imports ────────────────────────
        // Tally's internal rounding can produce vouchers where debit ≠ credit
        // by a few paise/rupees. Absorb small differences (≤ ₹5) into a
        // ROUND_OFF line so createJournalEntry's strict balance check passes.
        const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
        const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
        const imbalance = Math.round((totalDebit - totalCredit) * 100) / 100;

        if (imbalance !== 0 && Math.abs(imbalance) <= 5) {
          const existingRoundOff = lines.find((l) => l.accountCode === "ROUND_OFF");
          if (existingRoundOff) {
            // Net the current value with the adjustment.
            // A journal line cannot have both debit AND credit > 0, so we must
            // compute the net and assign to the correct side.
            const netBefore = existingRoundOff.debit - existingRoundOff.credit;
            const netAfter = Math.round((netBefore - imbalance) * 100) / 100;
            if (Math.abs(netAfter) < 0.001) {
              // Net zero — remove the ROUND_OFF line entirely
              const idx = lines.indexOf(existingRoundOff);
              if (idx >= 0) lines.splice(idx, 1);
            } else {
              existingRoundOff.debit = netAfter > 0 ? netAfter : 0;
              existingRoundOff.credit = netAfter < 0 ? Math.abs(netAfter) : 0;
            }
          } else {
            // Insert a new ROUND_OFF line
            lines.push({
              accountCode: "ROUND_OFF" as AccountCode,
              debit: imbalance < 0 ? Math.abs(imbalance) : 0,
              credit: imbalance > 0 ? imbalance : 0,
              partyId: null,
              partyName: undefined,
            });
          }
        }

        await prisma.$transaction(async (tx: PrismaTx) => {
          // [P1] If voucher has inventory, create a Bill record first.
          let billId: string | null = null;
          if (
            voucher.inventoryRows &&
            voucher.inventoryRows.length > 0 &&
            (voucher.voucherType === "SALES" || voucher.voucherType === "PURCHASE") &&
            tallyTemplateId
          ) {
            // Find the party LEDGER line to get the partyId (usually the first line)
            const partyLine = lines.find((l) => l.partyId);
            if (partyLine) {
              const createdBill = await tx.bill.create({
                data: {
                  tenantId: tid,
                  billNumber: voucher.reference ? `TLY-${voucher.voucherType.substring(0, 3)}-${voucher.reference}-${crypto.randomBytes(2).toString('hex')}` : `IMP-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
                  templateId: tallyTemplateId,
                  partyId: partyLine.partyId!,
                  customerName: partyLine.partyName ?? "Customer",
                  rows: voucher.inventoryRows as any,
                  subtotal: voucher.inventoryRows.reduce((sum, r) => sum + (r.Amount || 0), 0),
                  taxPercent: voucher.taxPercent ?? 0,
                  taxAmount: Math.abs(voucher.lines.filter(l => l.accountCode.includes("GST")).reduce((s, l) => s + (l.debit || l.credit), 0)),
                  grandTotal: Math.abs(partyLine.debit !== 0 ? partyLine.debit : partyLine.credit),
                  status: "FINAL",
                  isInterState: voucher.isInterState ?? false,
                  placeOfSupply: voucher.placeOfSupply,
                  date: voucher.entryDate,
                  createdBy: billCreatorId,
                },
              });
              billId = createdBill.id;

              // Audit the Bill creation
              await tx.auditLog.create({
                data: {
                  tenantId: tid,
                  entityType: "Bill",
                  entityId: billId,
                  userId: null,
                  actorType: "SYSTEM",
                  action: "CREATE",
                  newValue: JSON.stringify({ source: "tally-import-inventory" }),
                },
              });
            }
          }

          const journalEntry = await createJournalEntry(tx, {
            tenantId: tid,
            entryDate: voucher.entryDate,
            narration: voucher.narration,
            // [FIX] Resolve Credit Note / Debit Note types correctly.
            // parseTallyXml coerces voucherType to SALES/PURCHASE for return
            // vouchers; originalTypeName carries the raw Tally string needed
            // to restore CREDIT_NOTE / DEBIT_NOTE for balance computation.
            voucherType: resolveImportVoucherType(
              voucher.originalTypeName,
              voucher.voucherType
            ),
            createdBy: actorId ?? "SYSTEM",
            ...(voucher.remoteId ? { remoteId: voucher.remoteId } : {}),
            billId: billId ?? undefined, // Link to the created bill if inventory was present
            lines,
          });

          // [I3] MCA GSR 247(E) — audit trail for import-created entries.
          // actorType=SYSTEM distinguishes automated imports from user actions.
          await tx.auditLog.create({
            data: {
              tenantId: tid,
              entityType: "JournalEntry",
              entityId: journalEntry.id,
              userId: null,
              actorType: "SYSTEM",
              action: "CREATE",
              newValue: JSON.stringify({
                source: "tally-import",
                jobId: job.id,
                remoteId: voucher.remoteId ?? null,
                voucherType: journalEntry.voucherType,
                placeOfSupply: voucher.placeOfSupply ?? null,
                taxPercent: voucher.taxPercent ?? null,
                hsnCodes: voucher.hsnCodes ?? [],
                isInterState: voucher.isInterState ?? null,
              }),
            },
          });
        }, { timeout: 8000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        return "imported";
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("Unique constraint") && voucher.remoteId) {
          return "skipped";
        }
        return err instanceof Error ? err : new Error(msg);
      }
    }

    const allVouchers = [...vouchersWithRemoteId, ...vouchersWithoutRemoteId];

    // Process in batches sequentially to avoid deadlocks on shared party rows.
    // Promise.allSettled was replaced: 50 parallel transactions caused lock
    // contention when multiple vouchers referenced the same party.
    for (let i = 0; i < allVouchers.length; i += BATCH_SIZE) {
      const batch = allVouchers.slice(i, i + BATCH_SIZE);

      for (const voucher of batch) {
        try {
          const result = await importVoucher(voucher);
          if (result === "skipped") skipped++;
          else if (result === "imported") imported++;
          else failed++; // result is an Error object
        } catch {
          failed++;
        }
      }

      // Update progress in DB after each batch
      await prisma.importJob.update({
        where: { id: job.id },
        data: {
          processed: imported + skipped,
          failed: failed,
        },
      });
    }

    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        processed: imported + skipped,
        failed: failed,
        // [S1] Clear raw XML to prevent storage bloat (up to 5MB per job).
        // All relevant data is already persisted in JournalEntries + AuditLog.
        xmlData: "",
      }
    });

    // [T2] Recompute balances for all parties touched during import.
    // Runs AFTER the job is marked COMPLETED so import success is not
    // blocked by a balance recompute failure.
    const affectedPartyIds = [...new Set(partyCache.values())];
    for (const pid of affectedPartyIds) {
      try {
        await recomputePartyBalance(null, pid, tid);
      } catch (err) {
        // Log but don't fail the import — balance can be recomputed on-demand
        logError("import.party-balance.error", { pid, jobId: job.id, error: err });
      }
    }

    return NextResponse.json({
      jobId: job.id,
      status: "COMPLETED",
      totalItems: vouchers.length,
      partiesCreated,
      imported,
      skipped,
      failed,
      parseErrors,
    });

  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    if (job?.id) {
      await prisma.importJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          error
        }
      });
    }
    logError("import.process.job-failed", { error: err });
    return NextResponse.json({
      jobId: job?.id,
      status: "FAILED",
      error,
    }, { status: 500 });
  } finally {
    // [W1-FIX] Guaranteed lock release in finally — covers success, catch, and
    // early returns. pg_advisory_unlock returns false (not an error) if the lock
    // was never acquired, but we gate on lockAcquired to avoid unnecessary calls.
    if (lockAcquired) {
      try { await prisma.$executeRaw`SELECT pg_advisory_unlock(${tenantLockKey})`; } catch { /* best effort */ }
    }
  }
}
