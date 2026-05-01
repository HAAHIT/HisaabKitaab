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
import { resolveVerifiedTenantId } from "@/lib/session-server";
import { logError, getRequestId } from "@/lib/observability";
import { checkRateLimit } from "@/lib/api-rate-limit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  if (role !== "ADMIN" && role !== "ACCOUNTANT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantId = await resolveVerifiedTenantId(request);
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await checkRateLimit(request, `reconcile:commit:${tenantId}`, 10);

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
        where: { statementId, status: "PENDING" },
        data: { status: "AMBIGUOUS" },
      });

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

      return { ambiguousCount: ambiguousUpdate.count, matchedCount: matched, totalRows: total };
    });

    return NextResponse.json({
      success: true,
      matchedCount: result.matchedCount,
      ambiguousCount: result.ambiguousCount,
      totalRows: result.totalRows,
    });
  } catch (error) {
    logError("reconcile.commit.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
