import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSession } from "@/lib/api-tenant";
import { recomputeBankBalance } from "@/lib/bank-balance.server";
import { logError, getRequestId } from "@/lib/observability";
import { checkRateLimit } from "@/lib/api-rate-limit";

export const runtime = "nodejs";

/** POST /api/bank-accounts/recompute — admin-only repair of currentBalance for every bank account. */
export async function POST(request: NextRequest) {
  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, role } = sessionResolution.session;

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rl = await checkRateLimit(request, `bank-accounts:recompute:${tenantId}`, 5);
  if (rl) return rl;

  try {
    const accounts = await prisma.bankAccount.findMany({
      where: { tenantId, isDeleted: false },
      select: { id: true, name: true },
    });

    const results: Array<{ id: string; name: string; balance: number | null; error?: string }> = [];
    for (const acc of accounts) {
      try {
        const balance = await recomputeBankBalance(acc.id, tenantId);
        results.push({ id: acc.id, name: acc.name, balance });
      } catch (err) {
        logError("bank-accounts.recompute.item.error", {
          requestId: getRequestId(request),
          bankAccountId: acc.id,
          error: err,
        });
        results.push({
          id: acc.id,
          name: acc.name,
          balance: null,
          error: err instanceof Error ? err.message : "Recompute failed",
        });
      }
    }

    return NextResponse.json({ recomputed: results.length, results });
  } catch (error) {
    logError("bank-accounts.recompute.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
