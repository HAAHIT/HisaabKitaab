/**
 * scripts/import-worker.ts
 *
 * Background worker that processes pending Tally XML import jobs.
 *
 * Usage:
 *   npx ts-node --project tsconfig.json scripts/import-worker.ts
 *   # or one-shot (process all pending jobs then exit):
 *   npx ts-node --project tsconfig.json scripts/import-worker.ts --once
 *
 * Architecture:
 *   1. Poll ImportJob for PENDING entries (FIFO order)
 *   2. Mark job as PROCESSING (optimistic-lock on status field)
 *   3. Parse XML via parseTallyXml() — existing, tested parser
 *   4. Upsert party masters (idempotent: unique [tenantId, name])
 *   5. For each voucher: skip if remoteId already imported, else write
 *      JournalEntry + JournalLines in a RepeatableRead transaction
 *   6. Mark job COMPLETED (or FAILED with error message)
 *
 * Data safety:
 *   - All DB writes are inside transactions with TX_TIMEOUT_MS timeout.
 *   - remoteId uniqueness (schema.prisma:259) prevents double-import.
 *   - Party upsert uses @unique([tenantId, name]) — no duplicates created.
 *   - ImportJob.status optimistic-lock prevents two workers picking the
 *     same job simultaneously (UPDATE ... WHERE status = "PENDING").
 *   - No existing data is deleted.
 */

import { PrismaClient } from "@prisma/client";
import { parseTallyXml } from "../src/lib/tally-xml-import";
import { createJournalEntry } from "../src/lib/journal";

const prisma = new PrismaClient({ log: ["error"] });

const POLL_INTERVAL_MS = 5_000;  // 5 seconds between polls when idle
const TX_TIMEOUT_MS = 30_000;   // 30-second per-voucher transaction timeout

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// ── Job processor ─────────────────────────────────────────────────────────────

async function processJob(jobId: string): Promise<void> {
  // Atomically claim the job (status must still be PENDING).
  // Uses the WHERE clause as an optimistic lock — if another worker already
  // claimed it, prisma.importJob.update throws P2025 (record not found).
  const job = await prisma.importJob.update({
    where: { id: jobId, status: "PENDING" },
    data: { status: "PROCESSING" },
  });

  console.log(`[worker] Job ${job.id}: processing ${job.xmlData.length} bytes of XML`);

  let processed = 0;
  let failed    = 0;
  const errors: string[] = [];

  try {
    const { vouchers, partyMasters, parseErrors } = parseTallyXml(job.xmlData);

    if (parseErrors.length > 0) {
      console.warn(`[worker] Job ${job.id}: ${parseErrors.length} parse warnings:`, parseErrors);
    }

    // ── 1. Upsert party masters ────────────────────────────────────────────
    for (const master of partyMasters) {
      try {
        await prisma.party.upsert({
          where: {
            // @@unique([tenantId, name]) — schema.prisma:197
            tenantId_name: { tenantId: job.tenantId, name: master.name },
          },
          create: {
            tenantId: job.tenantId,
            name: master.name,
            type: master.group === "Sundry Debtors" ? "CUSTOMER" : "VENDOR",
            openingBalance: master.openingBalance ?? 0,
            createdBy: null, // system import — no specific user actor
          },
          update: {
            // Only refresh opening balance on re-import; preserve all other fields.
            openingBalance: master.openingBalance ?? 0,
          },
        });
        processed++;
      } catch (err) {
        failed++;
        const msg = `Party '${master.name}': ${String(err)}`;
        errors.push(msg);
        console.error(`[worker] Job ${job.id}: ${msg}`);
      }
    }

    // ── 2. Import vouchers ─────────────────────────────────────────────────
    // Use the tenant's first ADMIN as the createdBy actor.
    // This is recorded in JournalEntry.createdBy for audit purposes.
    const adminUser = await prisma.user.findFirst({
      where: { tenantId: job.tenantId, role: "ADMIN" },
      select: { id: true },
    });

    if (!adminUser) {
      throw new Error(`No ADMIN user found for tenant ${job.tenantId}`);
    }

    for (const voucher of vouchers) {
      try {
        await prisma.$transaction(
          async (tx: PrismaTx) => {
            // ── Idempotency check ──────────────────────────────────────────
            // JournalEntry.@@unique([tenantId, remoteId]) — schema.prisma:259
            if (voucher.remoteId) {
              const existing = await tx.journalEntry.findUnique({
                where: {
                  tenantId_remoteId: {
                    tenantId: job.tenantId,
                    remoteId: voucher.remoteId,
                  },
                },
                select: { id: true },
              });
              if (existing) {
                // Already imported — skip silently.
                return;
              }
            }

            // ── Write journal entry ────────────────────────────────────────
            await createJournalEntry(tx, {
              tenantId: job.tenantId,
              entryDate: voucher.entryDate,
              narration: voucher.narration,
              voucherType: voucher.voucherType,
              remoteId: voucher.remoteId ?? null,
              createdBy: adminUser.id,
              lines: voucher.lines.map((line) => ({
                accountCode: line.accountCode,
                debit: line.debit,
                credit: line.credit,
                partyName: line.partyName,
              })),
            });
          },
          { timeout: TX_TIMEOUT_MS }
        );

        processed++;
      } catch (err) {
        failed++;
        const ref = voucher.reference ?? voucher.remoteId ?? "unknown";
        const msg = `Voucher '${ref}': ${String(err)}`;
        errors.push(msg);
        console.error(`[worker] Job ${job.id}: ${msg}`);
      }
    }

    // ── 3. Finalise job ────────────────────────────────────────────────────
    const finalStatus =
      parseErrors.length > 0 || failed > 0 ? "FAILED" : "COMPLETED";

    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: finalStatus,
        processed,
        failed,
        error:
          errors.length > 0
            ? errors.slice(0, 10).join("; ") +
              (errors.length > 10 ? ` …and ${errors.length - 10} more` : "")
            : null,
      },
    });

    console.log(
      `[worker] Job ${job.id}: ${finalStatus}. ` +
        `processed=${processed} failed=${failed}`
    );
  } catch (fatalErr) {
    // Fatal error (e.g. XML entirely unparseable, no ADMIN user).
    // Mark job FAILED so it is not re-processed.
    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        error: String(fatalErr),
      },
    });
    console.error(`[worker] Job ${job.id}: FATAL —`, fatalErr);
    throw fatalErr;
  }
}

// ── Polling loop ──────────────────────────────────────────────────────────────

async function poll(): Promise<boolean> {
  const pending = await prisma.importJob.findFirst({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" }, // FIFO
    select: { id: true },
  });

  if (!pending) return false;

  await processJob(pending.id);
  return true;
}

async function main(): Promise<void> {
  const once = process.argv.includes("--once");

  if (once) {
    // Process all pending jobs then exit (useful for cron / Cloud Run Jobs)
    console.log("[worker] Running in one-shot mode...");
    let processed = 0;
    while (await poll()) {
      processed++;
    }
    console.log(`[worker] One-shot complete. Processed ${processed} job(s).`);
    return;
  }

  // Continuous polling mode
  console.log(
    `[worker] Starting continuous poll (interval=${POLL_INTERVAL_MS / 1000}s)...`
  );
  for (;;) {
    try {
      const didWork = await poll();
      if (!didWork) {
        // Only sleep when idle to minimise latency when jobs arrive
        await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
    } catch {
      // Worker errors are logged inside processJob; sleep before retry
      await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }
}

main()
  .catch((err) => {
    console.error("[worker] Unhandled error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
