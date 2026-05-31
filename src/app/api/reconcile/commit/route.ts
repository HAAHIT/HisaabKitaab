/**
 * POST /api/reconcile/commit
 *
 * Marks a BankStatement as fully reconciled.
 * All AUTO_MATCHED / MANUALLY_CATEGORIZED rows are confirmed.
 * Remaining PENDING rows are left as AMBIGUOUS.
 *
 * Body: { statementId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSession } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { createJournalEntry } from "@/lib/journal";
import { isValidReconcileCategoryCode } from "@/lib/bank-reconciliation/categories";
import type { AccountCode } from "@/lib/chart-of-accounts";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, role, userId } = sessionResolution.session;

  if (role !== "ADMIN" && role !== "ACCOUNTANT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rl = await checkRateLimit(request, `reconcile:commit:${tenantId}`, 10);
  if (rl) return rl;

  let body: { statementId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const statementId = typeof body.statementId === "string" ? body.statementId : null;
  if (!statementId) {
    return NextResponse.json({ error: "statementId is required" }, { status: 400 });
  }

  // Verify statement belongs to this tenant
  const statement = await prisma.bankStatement.findFirst({
    where: { id: statementId, tenantId },
    select: {
      id: true,
      isReconciled: true,
      bankAccount: { select: { type: true } },
    },
  });
  if (!statement) {
    return NextResponse.json({ error: "Statement not found" }, { status: 404 });
  }
  if (statement.isReconciled) {
    return NextResponse.json({ error: "Statement already reconciled" }, { status: 409 });
  }

  // Bank account type ("BANK" or "CASH") → chart-of-accounts code.
  const bankAccountCode: AccountCode =
    statement.bankAccount.type === "CASH" ? "CASH" : "BANK";

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Mark remaining PENDING rows as AMBIGUOUS
      const ambiguousUpdate = await tx.bankStatementRow.updateMany({
        where: { statementId, tenantId, status: "PENDING" },
        data: { status: "AMBIGUOUS" },
      });

      // Per BRS (Bank Reconciliation Statement) standards, reconciliation does not
      // create new journal entries for matched payments — the original payment
      // vouchers already posted to the Bank ledger. We only stamp a `reconciledAt`
      // timestamp confirming the bank statement attests these movements.
      const matchedRows = await tx.bankStatementRow.findMany({
        where: {
          statementId,
          tenantId,
          status: { in: ["AUTO_MATCHED", "MANUALLY_CATEGORIZED"] },
          matchedPaymentId: { not: null },
        },
        select: { matchedPaymentId: true },
      });
      const matchedPaymentIds = matchedRows
        .map((r) => r.matchedPaymentId)
        .filter((id): id is string => !!id);

      const reconciledPaymentUpdate = matchedPaymentIds.length
        ? await tx.payment.updateMany({
            where: { id: { in: matchedPaymentIds }, tenantId, reconciledAt: null },
            data: { reconciledAt: new Date() },
          })
        : { count: 0 };

      // For each MANUALLY_CATEGORIZED row tagged with a categoryCode (and no
      // matchedPaymentId), post a balanced JOURNAL voucher:
      //   INCOMING:  Dr Bank  Cr <categoryCode>   (e.g. interest credited)
      //   OUTGOING:  Dr <categoryCode>  Cr Bank   (e.g. bank charges)
      const journalRows = await tx.bankStatementRow.findMany({
        where: {
          statementId,
          tenantId,
          status: "MANUALLY_CATEGORIZED",
          matchedPaymentId: null,
          categoryCode: { not: null },
          journalEntryId: null,
        },
        select: {
          id: true,
          date: true,
          description: true,
          amount: true,
          direction: true,
          categoryCode: true,
        },
      });

      let journalsCreated = 0;
      for (const row of journalRows) {
        if (!row.categoryCode || !isValidReconcileCategoryCode(row.categoryCode)) continue;
        const categoryCode = row.categoryCode as AccountCode;
        const amount = Number(row.amount);
        if (!(amount > 0)) continue;

        const isIncoming = row.direction === "INCOMING";
        const journal = await createJournalEntry(tx, {
          tenantId,
          entryDate: row.date,
          narration: `Bank reconciliation: ${row.description}`.slice(0, 250),
          voucherType: "JOURNAL",
          createdBy: userId,
          lines: [
            {
              accountCode: isIncoming ? bankAccountCode : categoryCode,
              debit: amount,
              credit: 0,
            },
            {
              accountCode: isIncoming ? categoryCode : bankAccountCode,
              debit: 0,
              credit: amount,
            },
          ],
        });

        await tx.bankStatementRow.update({
          where: { id: row.id },
          data: { journalEntryId: journal.id },
        });
        journalsCreated++;
      }

      // Final counts
      const [matched, total] = await Promise.all([
        tx.bankStatementRow.count({
          where: {
            statementId,
            status: { in: ["AUTO_MATCHED", "MANUALLY_CATEGORIZED"] },
          },
        }),
        tx.bankStatementRow.count({ where: { statementId } }),
      ]);

      // Mark the statement as reconciled
      await tx.bankStatement.update({
        where: { id: statementId },
        data: {
          isReconciled: true,
          matchedCount: matched,
          unmatchedCount: total - matched,
        },
      });

      return {
        ambiguousCount: ambiguousUpdate.count,
        matchedCount: matched,
        reconciledPaymentCount: reconciledPaymentUpdate.count,
        journalsCreated,
        totalRows: total,
      };
    });

    return NextResponse.json({
      success: true,
      matchedCount: result.matchedCount,
      ambiguousCount: result.ambiguousCount,
      reconciledPaymentCount: result.reconciledPaymentCount,
      journalsCreated: result.journalsCreated,
      totalRows: result.totalRows,
    });
  } catch (error) {
    logError("reconcile.commit.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
