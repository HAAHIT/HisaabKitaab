import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseTallyXml } from "@/lib/tally-xml-import";
import { createJournalEntry } from "@/lib/journal";
import type { AccountCode } from "@/lib/chart-of-accounts";

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  // In a real app, verify cron-secret here via headers
  // For now, to allow testing, we proceed.
  
  // Pick a PENDING or long-running PROCESSING job
  const job = await prisma.importJob.findFirst({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" }
  });

  if (!job) {
    return NextResponse.json({ message: "No pending jobs" });
  }

  // Mark as processing
  await prisma.importJob.update({
    where: { id: job.id },
    data: { status: "PROCESSING" }
  });

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
        const fingerprint = `${voucher.voucherType}|${voucher.entryDate.toISOString()}|${voucher.narration}|${String(voucher.totalDebit)}`;
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
            voucherType: voucher.voucherType,
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
    
    // Process in batches and track progress
    for (let i = 0; i < allVouchers.length; i += BATCH_SIZE) {
      const batch = allVouchers.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(batch.map(importVoucher));

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === "rejected") failed++;
        else if (result.value === "skipped") skipped++;
        else if (result.value === "imported") imported++;
        else failed++;
      }

      // Update progress in DB
      await prisma.importJob.update({
        where: { id: job.id },
        data: {
          processed: imported + skipped,
          failed: failed
        }
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
