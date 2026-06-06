import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSession } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";
import { PLAN_LIMITS, getEffectivePlan } from "@/lib/plan-limits";

export const runtime = "nodejs";

/**
 * GET /api/billing/status
 *
 * Returns the tenant's current plan, effective plan (accounts for trial),
 * usage counters, and remaining quota. Used by the billing settings page
 * and the upgrade modal to show "47 of 100 bills used this month."
 *
 * Open to all roles in the tenant so accountants can see plan info too.
 */
export async function GET(request: NextRequest) {
  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId } = sessionResolution.session;

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        plan: true,
        trialEndsAt: true,
        planExpiresAt: true,
        subscriptionStatus: true,
        monthlyBillCount: true,
        monthlyPartyCount: true,
        usageWindowStart: true,
      },
    });
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const effectivePlan = getEffectivePlan(tenant.plan, tenant.trialEndsAt);
    const limits = PLAN_LIMITS[effectivePlan];

    // Live party count (limits.parties is a total cap, not monthly)
    const liveParties = await prisma.party.count({
      where: { tenantId, isDeleted: false, isActive: true },
    });

    const trialActive = !!(tenant.trialEndsAt && tenant.trialEndsAt.getTime() > Date.now());
    const trialDaysLeft = trialActive
      ? Math.ceil((tenant.trialEndsAt!.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      : 0;

    return NextResponse.json({
      plan: tenant.plan,
      effectivePlan,
      label: limits.label,
      subscriptionStatus: tenant.subscriptionStatus,
      planExpiresAt: tenant.planExpiresAt,
      trial: {
        active: trialActive,
        endsAt: tenant.trialEndsAt,
        daysLeft: trialDaysLeft,
      },
      usage: {
        bills:   { used: tenant.monthlyBillCount,  limit: limits.monthlyBills },
        parties: { used: liveParties,              limit: limits.parties },
      },
      features: {
        tallyExport: limits.tallyExport,
        tallyImport: limits.tallyImport,
        excelReports: limits.excelReports,
        creditNotes: limits.creditNotes,
        bankReconciliation: limits.bankReconciliation,
        purchaseOcr: limits.purchaseOcr,
        gstReturns: limits.gstReturns,
        accountantRole: limits.accountantRole,
        multiShop: limits.multiShop,
        customTallyLedgerMapping: limits.customTallyLedgerMapping,
        prioritySupport: limits.prioritySupport,
      },
    });
  } catch (error) {
    logError("billing.status.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
