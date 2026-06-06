/**
 * GET /api/reconcile/statements/[id]
 *
 * Returns a single BankStatement plus its rows in the same shape the upload
 * endpoint returns — so the UI can resume a pending statement from where it
 * left off without re-uploading the file.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSession } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId } = sessionResolution.session;

  const { id } = await context.params;

  try {
    const statement = await prisma.bankStatement.findFirst({
      where: { id, tenantId },
      include: {
        rows: { orderBy: { date: "asc" } },
        bankAccount: { select: { name: true } },
      },
    });
    if (!statement) {
      return NextResponse.json({ error: "Statement not found" }, { status: 404 });
    }

    const preview = statement.rows.map((row) => ({
      id: row.id,
      date: row.date,
      description: row.description,
      amount: Number(row.amount),
      direction: row.direction,
      matchedPaymentId: row.matchedPaymentId,
      confidence: 0, // not stored — UI just needs the match link
      reason: row.status === "AUTO_MATCHED"
        ? "Auto-matched"
        : row.status === "MANUALLY_CATEGORIZED"
        ? (row.matchedPaymentId ? "Manually matched" : "Categorized for journal")
        : row.status === "IGNORED"
        ? "Ignored"
        : row.status === "AMBIGUOUS"
        ? "Left ambiguous"
        : "",
    }));

    return NextResponse.json({
      statementId: statement.id,
      rowCount: statement.rowCount,
      matchedCount: statement.matchedCount,
      isReconciled: statement.isReconciled,
      bankAccountName: statement.bankAccount.name,
      periodFrom: statement.periodFrom,
      periodTo: statement.periodTo,
      parseErrors: [],
      preview,
    });
  } catch (error) {
    logError("reconcile.statements.detail.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
