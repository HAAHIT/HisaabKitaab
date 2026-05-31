/**
 * POST /api/reconcile/categorize
 *
 * Three actions on a BankStatementRow:
 *  - MATCH:    link to an existing Payment (status → MANUALLY_CATEGORIZED).
 *  - JOURNAL:  tag with a categoryCode so commit auto-posts a Journal voucher.
 *  - IGNORE:   skip this row at commit time.
 *
 * Body:
 *   { rowId: string; action: "MATCH" | "JOURNAL" | "IGNORE";
 *     paymentId?: string; categoryCode?: string; category?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSession } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { isValidReconcileCategoryCode } from "@/lib/bank-reconciliation/categories";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, role } = sessionResolution.session;

  if (role !== "ADMIN" && role !== "ACCOUNTANT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rl = await checkRateLimit(request, `reconcile:categorize:${tenantId}`, 60);
  if (rl) return rl;

  let body: {
    rowId?: unknown;
    action?: unknown;
    paymentId?: unknown;
    category?: unknown;
    categoryCode?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rowId = typeof body.rowId === "string" ? body.rowId : null;
  const action = typeof body.action === "string" ? body.action : null;
  const paymentId = typeof body.paymentId === "string" ? body.paymentId : null;
  const category = typeof body.category === "string" ? body.category.trim() : null;
  const categoryCode = typeof body.categoryCode === "string" ? body.categoryCode : null;

  if (!rowId) return NextResponse.json({ error: "rowId is required" }, { status: 400 });
  if (action !== "MATCH" && action !== "JOURNAL" && action !== "IGNORE") {
    return NextResponse.json({ error: "action must be MATCH, JOURNAL, or IGNORE" }, { status: 400 });
  }
  if (action === "MATCH" && !paymentId) {
    return NextResponse.json({ error: "paymentId is required for MATCH action" }, { status: 400 });
  }
  if (action === "JOURNAL") {
    if (!categoryCode || !isValidReconcileCategoryCode(categoryCode)) {
      return NextResponse.json({ error: "valid categoryCode is required for JOURNAL action" }, { status: 400 });
    }
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
          status:
            action === "MATCH" || action === "JOURNAL"
              ? "MANUALLY_CATEGORIZED"
              : "IGNORED",
          matchedPaymentId: action === "MATCH" ? paymentId : null,
          categoryCode: action === "JOURNAL" ? categoryCode : null,
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
