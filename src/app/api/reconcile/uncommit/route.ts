/**
 * POST /api/reconcile/uncommit
 *
 * Reverses a committed reconciliation:
 *  - soft-deletes any JournalEntry rows the commit auto-created
 *  - clears reconciledAt on linked Payments (only those reconciled by this statement)
 *  - resets BankStatementRow.status: AMBIGUOUS → PENDING, MANUALLY_CATEGORIZED → PENDING
 *    (keeps the user's categoryCode / matchedPaymentId so they can re-review)
 *  - marks BankStatement.isReconciled = false
 *
 * Body: { statementId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSession } from "@/lib/api-tenant";
import { checkFeatureAccess } from "@/lib/quota";
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

  // [Phase 1 — Plan gate] Bank reconciliation is a PRO feature; enforce server-side.
  const feature = await checkFeatureAccess(tenantId, "bankReconciliation");
  if (!feature.allowed) {
    return NextResponse.json(
      { error: feature.reason ?? "Feature locked", code: "FEATURE_LOCKED", feature: "bankReconciliation" },
      { status: 402 }
    );
  }

  const rl = await checkRateLimit(request, `reconcile:uncommit:${tenantId}`, 10);
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

  const statement = await prisma.bankStatement.findFirst({
    where: { id: statementId, tenantId },
    select: { id: true, isReconciled: true },
  });
  if (!statement) {
    return NextResponse.json({ error: "Statement not found" }, { status: 404 });
  }
  if (!statement.isReconciled) {
    return NextResponse.json({ error: "Statement is not reconciled" }, { status: 409 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const rows = await tx.bankStatementRow.findMany({
        where: { statementId, tenantId },
        select: { id: true, journalEntryId: true, matchedPaymentId: true, status: true },
      });

      const journalIds = rows
        .map((r) => r.journalEntryId)
        .filter((id): id is string => !!id);
      const paymentIds = rows
        .map((r) => r.matchedPaymentId)
        .filter((id): id is string => !!id);

      const journalsReversed = journalIds.length
        ? await tx.journalEntry.updateMany({
            where: { id: { in: journalIds }, tenantId },
            data: { isDeleted: true },
          })
        : { count: 0 };

      const paymentsCleared = paymentIds.length
        ? await tx.payment.updateMany({
            where: { id: { in: paymentIds }, tenantId },
            data: { reconciledAt: null },
          })
        : { count: 0 };

      const rowsReset = await tx.bankStatementRow.updateMany({
        where: {
          statementId,
          tenantId,
          status: { in: ["AMBIGUOUS", "MANUALLY_CATEGORIZED", "AUTO_MATCHED"] },
        },
        data: { status: "PENDING", journalEntryId: null },
      });

      await tx.bankStatement.update({
        where: { id: statementId },
        data: { isReconciled: false },
      });

      return {
        journalsReversed: journalsReversed.count,
        paymentsCleared: paymentsCleared.count,
        rowsReset: rowsReset.count,
      };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    logError("reconcile.uncommit.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
