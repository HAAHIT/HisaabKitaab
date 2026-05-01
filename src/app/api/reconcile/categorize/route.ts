/**
 * POST /api/reconcile/categorize
 *
 * Manually assign a payment to a BankStatementRow, or mark it IGNORED.
 *
 * Body:
 *   { rowId: string; action: "MATCH" | "IGNORE"; paymentId?: string; category?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveVerifiedTenantId } from "@/lib/session-server";
import { logError, getRequestId } from "@/lib/observability";
import { checkRateLimit } from "@/lib/api-rate-limit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = await resolveVerifiedTenantId(request);
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await checkRateLimit(request, `reconcile:categorize:${tenantId}`, 60);

  let body: { rowId?: unknown; action?: unknown; paymentId?: unknown; category?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rowId = typeof body.rowId === "string" ? body.rowId : null;
  const action = typeof body.action === "string" ? body.action : null;
  const paymentId = typeof body.paymentId === "string" ? body.paymentId : null;
  const category = typeof body.category === "string" ? body.category.trim() : null;

  if (!rowId) return NextResponse.json({ error: "rowId is required" }, { status: 400 });
  if (action !== "MATCH" && action !== "IGNORE") {
    return NextResponse.json({ error: "action must be MATCH or IGNORE" }, { status: 400 });
  }
  if (action === "MATCH" && !paymentId) {
    return NextResponse.json({ error: "paymentId is required for MATCH action" }, { status: 400 });
  }

  // Verify the row belongs to this tenant
  const row = await prisma.bankStatementRow.findFirst({
    where: { id: rowId, tenantId },
    select: { id: true, statementId: true, status: true },
  });
  if (!row) return NextResponse.json({ error: "Row not found" }, { status: 404 });

  if (action === "MATCH" && paymentId) {
    // Verify the payment belongs to this tenant
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, tenantId, isDeleted: false },
      select: { id: true },
    });
    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Update the row status
      await tx.bankStatementRow.update({
        where: { id: rowId },
        data: {
          status: action === "MATCH" ? "MANUALLY_CATEGORIZED" : "IGNORED",
          matchedPaymentId: action === "MATCH" ? paymentId : null,
          category: category ?? undefined,
        },
      });

      // Recompute matched/unmatched counts on the statement
      const [matched, total] = await Promise.all([
        tx.bankStatementRow.count({
          where: {
            statementId: row.statementId,
            status: { in: ["AUTO_MATCHED", "MANUALLY_CATEGORIZED"] },
          },
        }),
        tx.bankStatementRow.count({ where: { statementId: row.statementId } }),
      ]);

      await tx.bankStatement.update({
        where: { id: row.statementId },
        data: {
          matchedCount: matched,
          unmatchedCount: total - matched,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError("reconcile.categorize.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
