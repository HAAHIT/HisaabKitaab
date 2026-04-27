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

  try {
    const tid = job.tenantId;
    // Use the uploading user's ID for Bill.createdBy (FK to User table).
    // Fall back to "system" only for non-FK fields (JournalEntry, AuditLog, BillTemplate).
    const billCreatorId = job.createdBy ?? "system";
    const actorId = job.createdBy ?? "system";

    // Stage: parsing XML
    await prisma.importJob.update({
      where: { id: job.id },
      data: { stage: "parsing" },
    });

    // [S-W1] Decompress if stored with gzip prefix (backwards-compatible with raw XML)
    let xmlText = job.xmlData;
    if (xmlText.startsWith("gzip:")) {
      const compressed = Buffer.from(xmlText.slice(5), "base64");
      xmlText = gunzipSync(compressed).toString("utf-8");
    }

    const { vouchers, partyMasters, bankMasters, parseErrors } = parseTallyXml(xmlText);

    if (parseErrors.length > 0 && vouchers.length === 0 && partyMasters.length === 0 && bankMasters.length === 0) {
      throw new Error(parseErrors.join("; "));
    }

    await prisma.importJob.update({
      where: { id: job.id },
      data: { totalItems: vouchers.length, stage: "parties" },
    });

    const needsTallyTemplate = vouchers.some(
      (voucher) =>
        voucher.voucherType === "SALES" ||
        voucher.voucherType === "PURCHASE"
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
        },
        select: { id: true },
      });
      bankAccountCache.set(bm.name, upserted.id);
    }

    // Pre-populate cache from existing BankAccounts (for DayBook imports after Master import)
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
      // Check cancellation between party batches
      const jobCheck = await prisma.importJob.findUnique({
        where: { id: job.id },
        select: { status: true },
      });
      if (jobCheck?.status === "FAILED") {
        return NextResponse.json({
          jobId: job.id, status: "FAILED", error: "Cancelled by user",
          partiesCreated, imported: 0, skipped: 0, failed: 0,
        });
      }
    }

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    const vouchersWithRemoteId = vouchers.filter((v) => v.remoteId);
    const vouchersWithoutRemoteId = vouchers.filter((v) => !v.remoteId);

    let duplicateFingerprints = new Set<string>();

    // Clean up stale PROCESSING jobs older than 10 minutes (crashed/leaked)
    const staleThreshold = new Date(Date.now() - 10 * 60 * 1000);
    await prisma.importJob.updateMany({
      where: {
        tenantId: tid,
        status: "PROCESSING",
        id: { not: job.id },
        updatedAt: { lt: staleThreshold },
      },
      data: { status: "FAILED", stage: "done", error: "Timed out" },
    });

    // Concurrency guard: check for other active PROCESSING jobs for this tenant.
    const otherProcessing = await prisma.importJob.count({
      where: {
        tenantId: tid,
        status: "PROCESSING",
        id: { not: job.id },
      },
    });
    if (otherProcessing > 0) {
      await prisma.importJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          stage: "done",
          error: "Another import is already running. Please try again in a minute.",
        },
      });
      return NextResponse.json({
        jobId: job.id,
        status: "FAILED",
        error: "Another import is already running",
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
              ledgerName: "Round Off",
              debit: imbalance < 0 ? Math.abs(imbalance) : 0,
              credit: imbalance > 0 ? imbalance : 0,
              partyId: null,
              partyName: undefined,
            });
          }
        }

        await prisma.$transaction(async (tx: PrismaTx) => {
          let billId: string | null = null;
          let paymentId: string | null = null;

          const resolvedType = resolveImportVoucherType(voucher.originalTypeName, voucher.voucherType);
          const isSalesOrPurchase = resolvedType === "SALES" || resolvedType === "PURCHASE" || resolvedType === "CREDIT_NOTE" || resolvedType === "DEBIT_NOTE";
          const isPaymentOrReceipt = resolvedType === "RECEIPT" || resolvedType === "PAYMENT" || resolvedType === "CONTRA";

          if (isSalesOrPurchase && tallyTemplateId) {
            // Find the party LEDGER line if available (cash/online sales may not have one)
            const partyLine = lines.find((l) => l.partyId);
            const isPurchase = resolvedType === "PURCHASE" || resolvedType === "DEBIT_NOTE";
            const cashBankLine = lines.find((l) => l.accountCode === "CASH" || l.accountCode === "BANK" || l.accountCode === "UPI");

            // Compute grandTotal from the SALES/PURCHASE account line or total debit
            const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
            const grandTotal = partyLine
              ? Math.abs(partyLine.debit !== 0 ? partyLine.debit : partyLine.credit)
              : totalDebit;

            // Derive customer name: party name → primary ledger name (Cash/Online) → fallback
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

            // Issue #3 fix: use voucher index for unique bill numbers
            const createdBill = await tx.bill.create({
              data: {
                tenantId: tid,
                billNumber: voucher.reference ? voucher.reference : `IMP-${job.id.slice(-6)}-${imported + skipped + failed}`,
                templateId: tallyTemplateId,
                partyId: partyLine?.partyId ?? null,
                customerName,
                notes: voucher.narration || null,
                rows: rows as any,
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

            await tx.auditLog.create({
              data: {
                tenantId: tid,
                entityType: "Bill",
                entityId: billId,
                userId: null,
                actorType: "SYSTEM",
                action: "CREATE",
                newValue: JSON.stringify({ source: "tally-import" }),
              },
            });

            // Issue #2 fix: create Payment record for cash/bank sales so it shows in Banking
            if (cashBankLine) {
              const saleAccountId = cashBankLine.ledgerName
                ? bankAccountCache.get(cashBankLine.ledgerName) ?? null
                : null;
              const salePaymentAmount = Math.abs(cashBankLine.debit !== 0 ? cashBankLine.debit : cashBankLine.credit);
              const saleMode = cashBankLine.accountCode === "CASH" ? "CASH"
                : cashBankLine.accountCode === "UPI" ? "UPI"
                : "BANK_TRANSFER";

              const createdPayment = await tx.payment.create({
                data: {
                  tenantId: tid,
                  partyId: partyLine?.partyId ?? null,
                  accountId: saleAccountId,
                  linkedBillId: billId,
                  amount: salePaymentAmount,
                  date: voucher.entryDate,
                  direction: isPurchase ? "OUTGOING" : "INCOMING",
                  mode: saleMode as "CASH" | "UPI" | "BANK_TRANSFER",
                  status: "COMPLETED",
                  referenceNo: voucher.reference || null,
                  notes: voucher.narration,
                  createdBy: billCreatorId,
                }
              });
              paymentId = createdPayment.id;
            }
          } else if (isPaymentOrReceipt) {
            const partyLine = lines.find((l) => l.partyId);
            const bankLines = lines.filter((l) => l.accountCode === "CASH" || l.accountCode === "BANK" || l.accountCode === "UPI");
            const cashBankLine = bankLines[0];

            // Compute amount from party line or the cash/bank line
            const paymentAmount = partyLine
              ? Math.abs(partyLine.debit !== 0 ? partyLine.debit : partyLine.credit)
              : cashBankLine
                ? Math.abs(cashBankLine.debit !== 0 ? cashBankLine.debit : cashBankLine.credit)
                : lines.reduce((s, l) => s + l.debit, 0);

            const isContra = resolvedType === "CONTRA";
            const direction = resolvedType === "RECEIPT" ? "INCOMING"
              : resolvedType === "PAYMENT" ? "OUTGOING"
              : "OUTGOING"; // CONTRA: source debits, destination credits

            const mode = cashBankLine?.accountCode === "CASH" ? "CASH"
              : cashBankLine?.accountCode === "UPI" ? "UPI"
              : "BANK_TRANSFER";

            // Resolve source bank account (debit side for CONTRA, or the cash/bank line)
            let sourceAccountId: string | null = null;
            let destAccountId: string | null = null;

            if (isContra && bankLines.length >= 2) {
              // Contra: debit line = destination (money goes in), credit line = source (money goes out)
              const debitLine = bankLines.find((l) => l.debit > 0);
              const creditLine = bankLines.find((l) => l.credit > 0);
              sourceAccountId = creditLine?.ledgerName
                ? bankAccountCache.get(creditLine.ledgerName) ?? null
                : null;
              destAccountId = debitLine?.ledgerName
                ? bankAccountCache.get(debitLine.ledgerName) ?? null
                : null;
            } else {
              sourceAccountId = cashBankLine?.ledgerName
                ? bankAccountCache.get(cashBankLine.ledgerName) ?? null
                : null;
            }

            const createdPayment = await tx.payment.create({
              data: {
                tenantId: tid,
                partyId: partyLine?.partyId ?? null,
                accountId: sourceAccountId,
                destinationAccountId: destAccountId,
                amount: paymentAmount,
                date: voucher.entryDate,
                direction,
                mode,
                status: "COMPLETED",
                referenceNo: voucher.reference || null,
                notes: voucher.narration,
                createdBy: billCreatorId,
              }
            });
            paymentId = createdPayment.id;

            await tx.auditLog.create({
              data: {
                tenantId: tid,
                entityType: "Payment",
                entityId: paymentId,
                userId: null,
                actorType: "SYSTEM",
                action: "CREATE",
                newValue: JSON.stringify({ source: "tally-import" }),
              },
            });
          }

          const journalEntry = await createJournalEntry(tx, {
            tenantId: tid,
            entryDate: voucher.entryDate,
            narration: voucher.narration,
            voucherType: resolvedType,
            createdBy: actorId ?? "SYSTEM",
            ...(voucher.remoteId ? { remoteId: voucher.remoteId } : {}),
            billId: billId ?? undefined, // Link to created bill
            paymentId: paymentId ?? undefined, // Link to created payment
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

    // Stage: importing vouchers
    await prisma.importJob.update({
      where: { id: job.id },
      data: { stage: "importing" },
    });

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

      // Check if job was cancelled by user between batches
      const currentJob = await prisma.importJob.findUnique({
        where: { id: job.id },
        select: { status: true },
      });
      if (currentJob?.status === "FAILED") {
        // User cancelled — stop processing, keep what was already imported
        return NextResponse.json({
          jobId: job.id,
          status: "FAILED",
          error: "Cancelled by user",
          imported,
          skipped,
          failed,
        });
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

    // Stage: recomputing party balances
    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        stage: "balances",
        processed: imported + skipped,
        failed: failed,
      }
    });

    // [T2] Recompute balances for all parties touched during import.
    const affectedPartyIds = [...new Set(partyCache.values())];
    for (const pid of affectedPartyIds) {
      try {
        await recomputePartyBalance(null, pid, tid);
      } catch (err) {
        logError("import.party-balance.error", { pid, jobId: job.id, error: err });
      }
    }

    // Recompute bank account balances from their linked payments
    const affectedBankIds = [...new Set(bankAccountCache.values())];
    for (const bankId of affectedBankIds) {
      try {
        const account = await prisma.bankAccount.findUnique({
          where: { id: bankId },
          select: { openingBalance: true },
        });
        if (!account) continue;

        const result = await prisma.payment.aggregate({
          where: {
            tenantId: tid,
            isDeleted: false,
            status: "COMPLETED",
            OR: [
              { accountId: bankId },
              { destinationAccountId: bankId },
            ],
          },
          _sum: { amount: true },
          _count: true,
        });

        // Compute net: incoming adds, outgoing subtracts
        const payments = await prisma.payment.findMany({
          where: {
            tenantId: tid,
            isDeleted: false,
            status: "COMPLETED",
            OR: [
              { accountId: bankId },
              { destinationAccountId: bankId },
            ],
          },
          select: { amount: true, direction: true, accountId: true, destinationAccountId: true },
        });

        let net = 0;
        for (const p of payments) {
          const amt = Number(p.amount);
          if (p.accountId === bankId) {
            // This is the source account
            net += p.direction === "INCOMING" ? amt : -amt;
          } else if (p.destinationAccountId === bankId) {
            // This is the destination (contra transfer in)
            net += amt;
          }
        }

        await prisma.bankAccount.update({
          where: { id: bankId },
          data: { currentBalance: Number(account.openingBalance) + net },
        });
      } catch (err) {
        logError("import.bank-balance.error", { bankId, jobId: job.id, error: err });
      }
    }

    // Stage: done — mark completed and clear raw XML
    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        stage: "done",
        processed: imported + skipped,
        failed: failed,
        partiesCreated,
        xmlData: "",
      }
    });

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
  }
}
