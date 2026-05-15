import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseTallyXml, type TallyParseResult } from "@/lib/tally-xml-import";
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

export async function processImportJob(jobId?: string, preparsed?: TallyParseResult) {
  // ── Atomic job claim ────────────────────────────────────────────────────────
  // Two-step: find oldest PENDING job, then atomically update only if it is
  // still PENDING. If two cron workers race, only one will see count=1.
  const candidate = jobId
    ? await prisma.importJob.findFirst({ where: { id: jobId, status: "PENDING" } })
    : await prisma.importJob.findFirst({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
      });

  if (!candidate) {
    return NextResponse.json({ message: jobId ? "Job is not pending" : "No pending jobs" });
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
    const actorId = job.createdBy ?? "system";
    const billCreatorId = job.createdBy ?? "system";

    // [PERF-4] Use preparsed data from upload route when available to skip
    // decompression + re-parse. Cron recovery path falls back to stored XML.
    let vouchers: TallyParseResult["vouchers"];
    let partyMasters: TallyParseResult["partyMasters"];
    let bankMasters: TallyParseResult["bankMasters"];

    if (preparsed) {
      ({ vouchers, partyMasters, bankMasters } = preparsed);
    } else {
      // [S-W1] Decompress if stored with gzip prefix (backwards-compatible with raw XML)
      let xmlText = job.xmlData;
      if (xmlText.startsWith("gzip:")) {
        const compressed = Buffer.from(xmlText.slice(5), "base64");
        xmlText = gunzipSync(compressed).toString("utf-8");
      }
      ({ vouchers, partyMasters, bankMasters } = parseTallyXml(xmlText));
    }

    const needsTallyTemplate = vouchers.some(
      (voucher) =>
        voucher.voucherType === "SALES" ||
        voucher.voucherType === "PURCHASE"
    );

    let tallyTemplateId: string | null = null;
    if (needsTallyTemplate) {
      const existingTallyTemplate = await prisma.billTemplate.findFirst({
        where: { name: "__TALLY_IMPORT__", tenantId: tid },
        select: { id: true },
      });
      if (existingTallyTemplate) {
        tallyTemplateId = existingTallyTemplate.id;
      } else {
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

    // [PERF-1] Parallelize party master upserts in batches of 25 instead of
    // sequentially. Audit logs for new parties are collected and bulk-inserted
    // with createMany after all batches complete.
    const PARTY_UPSERT_BATCH = 25;
    const partyAuditLogs: Prisma.AuditLogCreateManyInput[] = [];

    for (let i = 0; i < partyMasters.length; i += PARTY_UPSERT_BATCH) {
      const batch = partyMasters.slice(i, i + PARTY_UPSERT_BATCH);
      const results = await Promise.all(
        batch.map(async (pm) => {
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
          return { pm, upserted };
        })
      );
      for (const { pm, upserted } of results) {
        if (upserted.createdAt.getTime() === upserted.updatedAt.getTime()) {
          partiesCreated++;
          // [I3] Audit trail for import-created parties (MCA GSR 247(E)).
          partyAuditLogs.push({
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
          });
        }
        partyCache.set(pm.name, upserted.id);
      }
    }

    if (partyAuditLogs.length > 0) {
      await prisma.auditLog.createMany({ data: partyAuditLogs });
    }

    // ── Bank / Cash account creation from Tally masters ─────────────────────
    const bankAccountCache = new Map<string, string>(); // ledger name → BankAccount.id
    for (const bm of bankMasters) {
      const upserted = await prisma.bankAccount.upsert({
        where: { tenantId_name: { tenantId: tid, name: bm.name } },
        update: {},
        create: {
          tenantId: tid,
          name: bm.name,
          type: bm.type,
          accountNumber: bm.accountNumber,
          openingBalance: bm.openingBalance,
          currentBalance: bm.openingBalance,
          createdBy: actorId,
          updatedAt: new Date(),
        },
        select: { id: true },
      });
      bankAccountCache.set(bm.name, upserted.id);
    }

    // Pre-populate from existing accounts for DayBook-only imports (no masters)
    if (bankAccountCache.size === 0) {
      const existingAccounts = await prisma.bankAccount.findMany({
        where: { tenantId: tid, isDeleted: false },
        select: { id: true, name: true },
      });
      for (const acc of existingAccounts) {
        bankAccountCache.set(acc.name, acc.id);
      }
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
    const allPartyNames = [
      ...new Set(
        vouchers
          .flatMap((v) => v.lines.map((l) => l.partyName))
          .filter((n): n is string => !!n)
      ),
    ].filter((name) => !partyCache.has(name));

    const PARTY_BATCH = 25;
    for (let i = 0; i < allPartyNames.length; i += PARTY_BATCH) {
      const batch = allPartyNames.slice(i, i + PARTY_BATCH);
      await Promise.all(
        batch.map((name) => resolvePartyId(name, "SUNDRY_DEBTORS"))
      );
    }

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    const vouchersWithRemoteId = vouchers.filter((v) => v.remoteId);
    const vouchersWithoutRemoteId = vouchers.filter((v) => !v.remoteId);

    let duplicateFingerprints = new Set<string>();

    // Reset any PROCESSING jobs for this tenant that have been stuck for >10 minutes
    // (covers server crashes, serverless timeouts, killed processes).
    const staleThreshold = new Date(Date.now() - 10 * 60 * 1000);
    await prisma.importJob.updateMany({
      where: {
        tenantId: tid,
        status: "PROCESSING",
        id: { not: job.id },
        updatedAt: { lt: staleThreshold },
      },
      data: { status: "FAILED", error: "Timed out" },
    });

    // Concurrency guard: if another PROCESSING job exists for this tenant, revert to PENDING.
    const otherProcessing = await prisma.importJob.count({
      where: { tenantId: tid, status: "PROCESSING", id: { not: job.id } },
    });
    if (otherProcessing > 0) {
      await prisma.importJob.update({
        where: { id: job.id },
        data: { status: "PENDING" },
      });
      return NextResponse.json({
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
      const existingFingerprints: { fp: string }[] = await prisma.$queryRaw`
        SELECT CONCAT(
          "voucherType", '|',
          TO_CHAR("entryDate", 'YYYY-MM-DD'), '|',
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
    const CONCURRENCY = 10;

    // [PERF-2/5] importVoucher uses ReadCommitted isolation (pure INSERTs, no
    // read-modify-write cycles) and returns audit log rows for bulk insert
    // outside the transaction, reducing per-transaction scope.
    async function importVoucher(
      voucher: (typeof vouchers)[number],
      pendingAuditLogs: Prisma.AuditLogCreateManyInput[]
    ): Promise<"imported" | "skipped" | Error> {
      if (!voucher.remoteId) {
        // Use date string only (YYYY-MM-DD) for fingerprint — avoids IST/UTC
        // mismatch where Tally's YYYYMMDD date becomes the previous day in UTC.
        const dateStr = voucher.entryDate.toISOString().slice(0, 10);
        const resolvedType = resolveImportVoucherType(voucher.originalTypeName, voucher.voucherType);
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
              ledgerName: line.ledgerName,
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
            const netBefore = existingRoundOff.debit - existingRoundOff.credit;
            const netAfter = Math.round((netBefore - imbalance) * 100) / 100;
            if (Math.abs(netAfter) < 0.001) {
              lines.splice(lines.indexOf(existingRoundOff), 1);
            } else {
              existingRoundOff.debit = netAfter > 0 ? netAfter : 0;
              existingRoundOff.credit = netAfter < 0 ? Math.abs(netAfter) : 0;
            }
          } else {
            lines.push({
              accountCode: "ROUND_OFF" as AccountCode,
              ledgerName: "Round Off",
              debit: imbalance < 0 ? Math.abs(imbalance) : 0,
              credit: imbalance > 0 ? imbalance : 0,
              partyId: null,
              partyName: undefined,
            });
          }
        }

        const resolvedVoucherType = resolveImportVoucherType(voucher.originalTypeName, voucher.voucherType);
        const isSalesOrPurchase = resolvedVoucherType === "SALES" || resolvedVoucherType === "PURCHASE" || resolvedVoucherType === "CREDIT_NOTE" || resolvedVoucherType === "DEBIT_NOTE";
        const isPaymentOrReceipt = resolvedVoucherType === "RECEIPT" || resolvedVoucherType === "PAYMENT" || resolvedVoucherType === "CONTRA";

        const txResult = await prisma.$transaction(async (tx: PrismaTx) => {
          const txAuditLogs: Prisma.AuditLogCreateManyInput[] = [];
          let billId: string | null = null;
          let paymentId: string | null = null;

          if (isSalesOrPurchase && tallyTemplateId) {
            const partyLine = lines.find((l) => l.partyId);
            const isPurchase = resolvedVoucherType === "PURCHASE" || resolvedVoucherType === "DEBIT_NOTE";

            const totalDebitForBill = lines.reduce((s, l) => s + l.debit, 0);
            const grandTotal = partyLine
              ? Math.abs(partyLine.debit !== 0 ? partyLine.debit : partyLine.credit)
              : totalDebitForBill;

            const primaryLine = lines.find((l) =>
              l.accountCode === "CASH" || l.accountCode === "BANK" || l.accountCode === "UPI"
              || l.accountCode === "SALES" || l.accountCode === "PURCHASE"
            );
            const customerName = partyLine?.partyName
              ?? primaryLine?.ledgerName
              ?? (isPurchase ? "Vendor" : "Cash Customer");

            const rows = voucher.inventoryRows && voucher.inventoryRows.length > 0
              ? voucher.inventoryRows
              : [{
                Item: isPurchase ? "Purchases" : "Sales",
                Qty: 1,
                Unit: "nos",
                Rate: grandTotal,
                Amount: grandTotal,
              }];

            const createdBill = await tx.bill.create({
              data: {
                tenantId: tid,
                billNumber: voucher.reference ? voucher.reference : `IMP-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
                templateId: tallyTemplateId,
                partyId: partyLine?.partyId ?? null,
                customerName,
                rows: rows as Prisma.InputJsonValue,
                subtotal: rows.reduce((sum: number, r: any) => sum + (r.Amount || 0), 0),
                taxPercent: voucher.taxPercent ?? 0,
                taxAmount: Math.abs(voucher.lines.filter(l => l.accountCode.includes("GST")).reduce((s, l) => s + (l.debit || l.credit), 0)),
                grandTotal,
                status: "FINAL",
                isInterState: voucher.isInterState ?? false,
                placeOfSupply: voucher.placeOfSupply,
                date: voucher.entryDate,
                createdBy: billCreatorId,
              },
            });
            billId = createdBill.id;
            txAuditLogs.push({
              tenantId: tid,
              entityType: "Bill",
              entityId: billId,
              userId: null,
              actorType: "SYSTEM",
              action: "CREATE",
              newValue: JSON.stringify({ source: "tally-import" }),
            });
          } else if (isPaymentOrReceipt) {
            const partyLine = lines.find((l) => l.partyId);
            const cashBankLine = lines.find((l) => l.accountCode === "CASH" || l.accountCode === "BANK" || l.accountCode === "UPI");

            const paymentAmount = partyLine
              ? Math.abs(partyLine.debit !== 0 ? partyLine.debit : partyLine.credit)
              : cashBankLine
                ? Math.abs(cashBankLine.debit !== 0 ? cashBankLine.debit : cashBankLine.credit)
                : lines.reduce((s, l) => s + l.debit, 0);

            const direction = resolvedVoucherType === "RECEIPT" ? "INCOMING" : "OUTGOING";
            const mode = cashBankLine?.accountCode === "CASH" ? "CASH"
              : cashBankLine?.accountCode === "UPI" ? "UPI"
              : "BANK_TRANSFER";

            const accountId = cashBankLine?.ledgerName
              ? (bankAccountCache.get(cashBankLine.ledgerName) ?? null)
              : null;

            const createdPayment = await tx.payment.create({
              data: {
                tenantId: tid,
                partyId: partyLine?.partyId ?? null,
                accountId,
                amount: paymentAmount,
                date: voucher.entryDate,
                direction,
                mode,
                status: "COMPLETED",
                referenceNo: voucher.reference || null,
                notes: voucher.narration,
                createdBy: billCreatorId,
              },
            });
            paymentId = createdPayment.id;
            txAuditLogs.push({
              tenantId: tid,
              entityType: "Payment",
              entityId: paymentId,
              userId: null,
              actorType: "SYSTEM",
              action: "CREATE",
              newValue: JSON.stringify({ source: "tally-import" }),
            });
          }

          const journalEntry = await createJournalEntry(tx, {
            tenantId: tid,
            entryDate: voucher.entryDate,
            narration: voucher.narration,
            voucherType: resolvedVoucherType,
            createdBy: actorId,
            ...(voucher.remoteId ? { remoteId: voucher.remoteId } : {}),
            billId: billId ?? undefined,
            paymentId: paymentId ?? undefined,
            lines,
          });

          txAuditLogs.push({
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
          });

          return { txAuditLogs };
        }, { timeout: 8000, isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });

        pendingAuditLogs.push(...txResult.txAuditLogs);
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

    for (let i = 0; i < allVouchers.length; i += BATCH_SIZE) {
      const batch = allVouchers.slice(i, i + BATCH_SIZE);
      const pendingAuditLogs: Prisma.AuditLogCreateManyInput[] = [];

      for (let j = 0; j < batch.length; j += CONCURRENCY) {
        const chunk = batch.slice(j, j + CONCURRENCY);
        const results = await Promise.allSettled(chunk.map((v) => importVoucher(v, pendingAuditLogs)));
        for (const r of results) {
          if (r.status === "fulfilled") {
            if (r.value === "skipped") skipped++;
            else if (r.value === "imported") imported++;
            else failed++;
          } else {
            failed++;
          }
        }
      }

      // [PERF-5] Bulk insert all audit logs accumulated during this batch
      if (pendingAuditLogs.length > 0) {
        await prisma.auditLog.createMany({ data: pendingAuditLogs });
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
        partiesCreated,
        // [S1] Clear raw XML to prevent storage bloat (up to 5MB per job).
        // All relevant data is already persisted in JournalEntries + AuditLog.
        xmlData: "",
      }
    });

    // [PERF-3] Recompute party balances in parallel batches of 20 instead of
    // sequentially — each recompute is independent and read-heavy.
    const affectedPartyIds = [...new Set(partyCache.values())];
    const BALANCE_BATCH = 3;
    for (let i = 0; i < affectedPartyIds.length; i += BALANCE_BATCH) {
      await Promise.allSettled(
        affectedPartyIds.slice(i, i + BALANCE_BATCH).map((pid) =>
          recomputePartyBalance(null, pid, tid).catch((err) =>
            logError("import.party-balance.error", { pid, jobId: job.id, error: err })
          )
        )
      );
    }

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
