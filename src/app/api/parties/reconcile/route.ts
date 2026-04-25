import { prisma } from "@/lib/prisma";
import { recomputePartyBalance } from "@/lib/party-balance.server";

import { resolveWriteSession } from "@/lib/api-tenant";
import { logError, logInfo, getRequestId } from "@/lib/observability";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// GET /api/parties/reconcile — report balance discrepancies (Admin only)
export async function GET(request: NextRequest) {
  // [FIX] Use JWT-verified session instead of trusting proxy headers
  const sessionResolution = await resolveWriteSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, role } = sessionResolution.session;

  if (role !== "ADMIN" && role !== "ACCOUNTANT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const parties = await prisma.party.findMany({
      where: { tenantId, isDeleted: false },
      select: { id: true, name: true, currentBalance: true },
    });

    const results = await Promise.all(
      parties.map(async (party: { id: string; name: string; currentBalance: { toNumber: () => number } }) => {
        const computed = await recomputePartyBalance(prisma, party.id, tenantId);
        const drift = Math.abs(computed - party.currentBalance.toNumber());
        return {
          partyId: party.id,
          name: party.name,
          stored: party.currentBalance,
          computed,
          ok: drift < 0.01,
        };
      })
    );

    const drifted = results.filter((r: { ok: boolean }) => !r.ok);
    return NextResponse.json({ total: results.length, drifted });
  } catch (error) {
    logError("parties.reconcile.check.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/parties/reconcile — fix all drifted balances (Admin only)
export async function POST(request: NextRequest) {
  // [FIX] Use JWT-verified session instead of trusting proxy headers
  const sessionResolution = await resolveWriteSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, role } = sessionResolution.session;

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // [FIX #3] Wrap reconciliation in a transaction for atomicity
    const fixed = await prisma.$transaction(async (tx) => {
      const parties = await tx.party.findMany({
        where: { tenantId, isDeleted: false },
        select: { id: true, name: true, currentBalance: true },
      });

      let count = 0;
      for (const party of parties) {
        const computed = await recomputePartyBalance(tx, party.id, tenantId);
        if (Math.abs(computed - party.currentBalance.toNumber()) >= 0.01) {
          await tx.party.update({
            where: { id: party.id },
            data: { currentBalance: computed },
          });
          count++;
        }
      }
      return count;
    });

    logInfo("parties.reconcile.fixed", { requestId: getRequestId(request), fixed });
    return NextResponse.json({ fixed });
  } catch (error) {
    logError("parties.reconcile.fix.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
