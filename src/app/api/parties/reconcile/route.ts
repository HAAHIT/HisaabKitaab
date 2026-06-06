import { prisma } from "@/lib/prisma";
import { recomputePartyBalance } from "@/lib/party-balance.server";

import { resolveSession } from "@/lib/api-tenant";
import { logError, logInfo, getRequestId } from "@/lib/observability";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// GET /api/parties/reconcile — report balance discrepancies (Admin only)
export async function GET(request: NextRequest) {
  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, role } = sessionResolution.session;

  if (role !== "ADMIN") {
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
  const sessionResolution2 = await resolveSession(request);
  if (!sessionResolution2.ok) return sessionResolution2.response;
  const { tenantId, role } = sessionResolution2.session;

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Optional `partyId` scopes the repair to a single party (used by the
    // party profile "Fix Balances" button). Without it, the whole tenant is
    // reconciled (admin maintenance job). Default must stay tenant-wide for
    // backward compatibility.
    const body = await request.json().catch(() => ({}));
    const partyId = typeof body?.partyId === "string" && body.partyId.trim()
      ? body.partyId.trim()
      : null;

    const parties = await prisma.party.findMany({
      where: { tenantId, isDeleted: false, ...(partyId ? { id: partyId } : {}) },
      select: { id: true, name: true, currentBalance: true },
    });

    if (partyId && parties.length === 0) {
      return NextResponse.json({ error: "Party not found" }, { status: 404 });
    }

    let fixed = 0;
    for (const party of parties) {
      const computed = await recomputePartyBalance(prisma, party.id, tenantId);
      if (Math.abs(computed - party.currentBalance.toNumber()) >= 0.01) {
        await prisma.party.update({
          where: { id: party.id },
          data: { currentBalance: computed },
        });
        fixed++;
      }
    }

    logInfo("parties.reconcile.fixed", { requestId: getRequestId(request), fixed, scope: partyId ? "party" : "tenant" });
    return NextResponse.json({ fixed, scope: partyId ? "party" : "tenant" });
  } catch (error) {
    logError("parties.reconcile.fix.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
