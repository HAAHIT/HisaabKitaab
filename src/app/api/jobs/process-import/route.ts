import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseTallyXml } from "@/lib/tally-xml-import";
import { createJournalEntry } from "@/lib/journal";
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
  | "DEBIT_NOTE";

export function resolveImportVoucherType(
  originalTypeName: string,
  baseType: string
): VoucherType {
  if (originalTypeName === "Sales Return" || originalTypeName === "Credit Note")
    return "CREDIT_NOTE";
  if (
    originalTypeName === "Purchase Return" ||
    originalTypeName === "Debit Note"
  )
    return "DEBIT_NOTE";
  return baseType as VoucherType;
}

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  // ── Auth: require CRON_SECRET header ───────────────────────────────────────
  const cronSecret = request.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  // ── Atomic job claim ────────────────────────────────────────────────────────
  // Two-step: find oldest PENDING job, then atomically update only if it is
  // still PENDING. If two cron workers race, only one will see count=1.
  const candidate = await prisma.importJob.findFirst({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });

  if (!candidate) {
    return NextResponse.json({ message: "No pending jobs" });
  }

  const claimed = await prisma.importJob.updateMany({
    where: { id: candidate.id, status: "PENDING" },
    data: { status: "PROCESSING" },
  });

  if (claimed.count === 0) {
    // Another worker already claimed this job between our findFirst and updateMany
    return NextResponse.json({ message: "Job already claimed by another worker" });
  }

  const job = candidate;

  try {
    const tid = job.tenantId;
    const actorId = "system"; // Internal cron actor
    
    const { vouchers, partyMasters } = parseTallyXml(job.xmlData);

    let partiesCreated = 0;
    const partyCache = new Map<string, string>();

    for (const pm of partyMasters) {
      const upserted = await prisma.party.upsert({
        where: { tenantId_name: { tenantId: tid, name: pm.name } },
        update: {}, 
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
      if (upserted.createdAt.getTime() === upserted.updatedAt.getTime()) {
        partiesCreated++;
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
        .map((name) => resolvePartyId(name, "SUNDRY_DEBTORS"))
    );

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    const vouchersWithRemoteId = vouchers.filter((v) => v.remoteId);
    const vouchersWithoutRemoteId = vouchers.filter((v) => !v.remoteId);

    let duplicateFingerprints = new Set<string>();
    if (vouchersWithoutRemoteId.length > 0) {
      const dates = vouchersWithoutRemoteId.map((v) => v.entryDate.getTime());
      const rangeMin = new Date(Math.min(...dates));
      const rangeMax = new Date(Math.max(...dates));
      const existingEntries = await prisma.journalEntry.findMany({
        where: {
          tenantId: tid,
          entryDate: { gte: rangeMin, lte: rangeMax },
          remoteId: null, 
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

    const BATCH_SIZE = 50;

    async function importVoucher(
      voucher: (typeof vouchers)[number]
    ): Promise<"imported" | "skipped" | Error> {
      if (!voucher.remoteId) {
        // Use date string only (YYYY-MM-DD) for fingerprint — avoids IST/UTC
        // mismatch where Tally's YYYYMMDD date becomes the previous day in UTC.
        const dateStr = voucher.entryDate.toISOString().slice(0, 10);
        const fingerprint = `${voucher.voucherType}|${dateStr}|${voucher.narration}|${String(voucher.totalDebit)}`;
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

        await prisma.$transaction(async (tx: PrismaTx) => {
          await createJournalEntry(tx, {
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
            createdBy: actorId,
            ...(voucher.remoteId ? { remoteId: voucher.remoteId } : {}),
            lines,
          });
        }, { timeout: 8000 });
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
        failed: failed
      }
    });

    return NextResponse.json({
      jobId: job.id,
      partiesCreated,
      imported,
      skipped,
      failed
    });

  } catch (err) {
    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        error: err instanceof Error ? err.message : String(err)
      }
    });
    return NextResponse.json({ error: "Job failed" }, { status: 500 });
  }
}
