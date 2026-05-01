/**
 * GET /api/reconcile/statements
 *
 * Lists BankStatement records for the tenant.
 * Optional query params:
 *   - bankAccountId: filter by account
 *   - limit: max records (default 20)
 *   - offset: pagination offset
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveVerifiedTenantId } from "@/lib/session-server";
import { logError, getRequestId } from "@/lib/observability";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = await resolveVerifiedTenantId(request);
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const bankAccountId = searchParams.get("bankAccountId") ?? undefined;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  try {
    const [statements, total] = await Promise.all([
      prisma.bankStatement.findMany({
        where: { tenantId, ...(bankAccountId ? { bankAccountId } : {}) },
        select: {
          id: true,
          bankAccountId: true,
          bankAccount: { select: { name: true } },
          periodFrom: true,
          periodTo: true,
          uploadedAt: true,
          rowCount: true,
          matchedCount: true,
          unmatchedCount: true,
          isReconciled: true,
        },
        orderBy: { uploadedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.bankStatement.count({
        where: { tenantId, ...(bankAccountId ? { bankAccountId } : {}) },
      }),
    ]);

    return NextResponse.json({ statements, total, limit, offset });
  } catch (error) {
    logError("reconcile.statements.list.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
