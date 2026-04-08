import { prisma } from "@/lib/prisma";
import { recomputePartyBalance } from "@/lib/accounting";
import { resolveReadTenant, resolveWriteTenant } from "@/lib/api-tenant";
import { logError, logInfo, getRequestId } from "@/lib/observability";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Produce a reconciliation report for the resolved tenant, listing parties whose stored balance differs from the recomputed balance by 0.01 or more.
 *
 * @param request - The incoming NextRequest. Requires an `x-user-role` header; only requests with role `ADMIN` are allowed.
 * @returns A JSON object with:
 *  - `total`: the number of parties examined
 *  - `drifted`: an array of parties whose stored balance differs from the computed balance. Each item contains:
 *      - `partyId`: the party's id
 *      - `name`: the party's name
 *      - `stored`: the stored `currentBalance`
 *      - `computed`: the recomputed balance
 *      - `ok`: `true` if the absolute difference (`|computed - stored|`) is less than 0.01, `false` otherwise
 *
 * Observable responses:
 *  - Returns 403 with `{ error: "Forbidden" }` when the requester is not an admin.
 *  - Returns 500 with `{ error: "Internal server error" }` on unexpected failures.
 */
export async function GET(request: NextRequest) {
  const role = request.headers.get("x-user-role");

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const tenantResolution = resolveReadTenant(request);
  if (!tenantResolution.ok) {
    return tenantResolution.response;
  }
  const tenantId = tenantResolution.tenantId;

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

/**
 * Recomputes stored balances for all non-deleted parties in the resolved tenant and updates any party whose stored balance differs from the recomputed balance by at least 0.01.
 *
 * @returns A NextResponse whose JSON body is `{ fixed: number }` with the count of updated parties on success; `{ error: "Forbidden" }` with status 403 if the requester is not an admin; or `{ error: "Internal server error" }` with status 500 if an unexpected error occurs.
 */
export async function POST(request: NextRequest) {
  const role = request.headers.get("x-user-role");

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const tenantResolution = await resolveWriteTenant(request);
  if (!tenantResolution.ok) {
    return tenantResolution.response;
  }
  const tenantId = tenantResolution.tenantId;

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
