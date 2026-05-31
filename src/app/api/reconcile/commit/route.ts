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

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, role } = sessionResolution.session;

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
    select: { id: true, isReconciled: true },
  });
  if (!statement) {
    return NextResponse.json({ error: "Statement not found" }, { status: 404 });
  }
  if (statement.isReconciled) {
    return NextResponse.json({ error: "Statement already reconciled" }, { status: 409 });
  }

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
        totalRows: total,
      };
    });

    return NextResponse.json({
      success: true,
      matchedCount: result.matchedCount,
      ambiguousCount: result.ambiguousCount,
      reconciledPaymentCount: result.reconciledPaymentCount,
      totalRows: result.totalRows,
    });
  } catch (error) {
    logError("reconcile.commit.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
