import { prisma } from "@/lib/prisma";
import { recomputePartyBalance } from "@/lib/accounting";
import { resolveVerifiedTenantId } from "@/lib/session-server";
import { TENANT_CONTEXT_MISSING_MESSAGE } from "@/lib/tenant";
import { logError, logInfo, getRequestId } from "@/lib/observability";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// GET /api/parties/reconcile — report balance discrepancies (Admin only)
export async function GET(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  const tenantId = await resolveVerifiedTenantId(request);

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!tenantId) {
    return NextResponse.json({ error: TENANT_CONTEXT_MISSING_MESSAGE }, { status: 500 });
  }

  try {
    const parties = await prisma.party.findMany({
      where: { tenantId, isDeleted: false },
      select: { id: true, name: true, currentBalance: true },
    });

    const results = await Promise.all(
      parties.map(async (party) => {
        const computed = await recomputePartyBalance(prisma, party.id, tenantId);
        const drift = Math.abs(computed - party.currentBalance);
        return {
          partyId: party.id,
          name: party.name,
          stored: party.currentBalance,
          computed,
          ok: drift < 0.01,
        };
      })
    );

    const drifted = results.filter((r) => !r.ok);
    return NextResponse.json({ total: results.length, drifted });
  } catch (error) {
    logError("parties.reconcile.check.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/parties/reconcile — fix all drifted balances (Admin only)
export async function POST(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  const tenantId = await resolveVerifiedTenantId(request);

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!tenantId) {
    return NextResponse.json({ error: TENANT_CONTEXT_MISSING_MESSAGE }, { status: 500 });
  }

  try {
    const parties = await prisma.party.findMany({
      where: { tenantId, isDeleted: false },
      select: { id: true, name: true, currentBalance: true },
    });

    let fixed = 0;
    for (const party of parties) {
      const computed = await recomputePartyBalance(prisma, party.id, tenantId);
      if (Math.abs(computed - party.currentBalance) >= 0.01) {
        await prisma.party.update({
          where: { id: party.id },
          data: { currentBalance: computed },
        });
        fixed++;
      }
    }

    logInfo("parties.reconcile.fixed", { requestId: getRequestId(request), fixed });
    return NextResponse.json({ fixed });
  } catch (error) {
    logError("parties.reconcile.fix.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
