/**
 * Tenant quota enforcement — runs before every mutation that would
 * increment a counter (new bill, new party). Returns a structured result
 * the route handler converts into a 402 PAYMENT_REQUIRED response if
 * `allowed=false`.
 *
 * Counters live on the Tenant row (`monthlyBillCount`, `monthlyPartyCount`)
 * with `usageWindowStart` driving a calendar-month rollover. Rollover is
 * lazy: we check on every quota call rather than running a cron, so the
 * counters self-heal even after long idle gaps.
 */

import { prisma } from "@/lib/prisma";
import { PLAN_LIMITS, getEffectivePlan, type QuotaCheck } from "@/lib/plan-limits";

type CounterField = "monthlyBillCount" | "monthlyPartyCount";

/**
 * IST-based month boundary — returns the first day of the IST month
 * containing `now`. Used to detect when the usage window has rolled over.
 */
function getCurrentMonthStart(now: Date = new Date()): Date {
  // Convert UTC → IST (UTC+5:30), get year/month, build back as UTC
  const istMs = now.getTime() + (5.5 * 60 * 60 * 1000);
  const ist = new Date(istMs);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - (5.5 * 60 * 60 * 1000));
}

/**
 * Internal: load tenant quota state and reset counters if the IST month
 * has rolled over. Returns the up-to-date counter values.
 */
async function getQuotaState(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      plan: true,
      trialEndsAt: true,
      monthlyBillCount: true,
      monthlyPartyCount: true,
      usageWindowStart: true,
    },
  });
  if (!tenant) {
    throw new Error(`Tenant ${tenantId} not found`);
  }

  const currentMonthStart = getCurrentMonthStart();
  const needsRollover = tenant.usageWindowStart.getTime() < currentMonthStart.getTime();

  if (needsRollover) {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        monthlyBillCount: 0,
        monthlyPartyCount: 0,
        usageWindowStart: currentMonthStart,
      },
    });
    return {
      plan: tenant.plan,
      trialEndsAt: tenant.trialEndsAt,
      monthlyBillCount: 0,
      monthlyPartyCount: 0,
    };
  }

  return tenant;
}

/**
 * Check whether the tenant may create one more bill this month.
 * Call before insert; on success, separately call `incrementCounter`
 * inside the same transaction as the bill.create.
 */
export async function checkBillQuota(tenantId: string): Promise<QuotaCheck> {
  const state = await getQuotaState(tenantId);
  const plan = getEffectivePlan(state.plan, state.trialEndsAt);
  const limit = PLAN_LIMITS[plan].monthlyBills;

  if (limit === null) {
    return { allowed: true, used: state.monthlyBillCount, limit: null };
  }

  const allowed = state.monthlyBillCount < limit;
  return {
    allowed,
    used: state.monthlyBillCount,
    limit,
    reason: allowed
      ? undefined
      : `You've used all ${limit} bills this month on the ${PLAN_LIMITS[plan].label} plan. Upgrade to Pakka for unlimited bills.`,
  };
}

/**
 * Check whether the tenant may add one more party.
 * Party count is total (not monthly) — landing copy promises "50 parties"
 * not "50 parties per month".
 */
export async function checkPartyQuota(tenantId: string): Promise<QuotaCheck> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true, trialEndsAt: true },
  });
  if (!tenant) throw new Error(`Tenant ${tenantId} not found`);

  const plan = getEffectivePlan(tenant.plan, tenant.trialEndsAt);
  const limit = PLAN_LIMITS[plan].parties;

  if (limit === null) {
    return { allowed: true, used: 0, limit: null };
  }

  // Count live parties (exclude soft-deleted, exclude inactive)
  const used = await prisma.party.count({
    where: { tenantId, isDeleted: false, isActive: true },
  });

  const allowed = used < limit;
  return {
    allowed,
    used,
    limit,
    reason: allowed
      ? undefined
      : `You've reached the ${limit}-party limit on the ${PLAN_LIMITS[plan].label} plan. Upgrade to Pakka for unlimited parties.`,
  };
}

/**
 * Increment the bill counter for the current usage window.
 * Idempotent across rollovers — uses Prisma atomic increment.
 */
export async function incrementBillCounter(
  tx: Pick<typeof prisma, "tenant">,
  tenantId: string,
): Promise<void> {
  await tx.tenant.update({
    where: { id: tenantId },
    data: { monthlyBillCount: { increment: 1 } },
  });
}

/**
 * Increment the monthly party-created counter. Used purely for analytics —
 * the live party count (for quota enforcement) is computed on demand.
 */
export async function incrementPartyCounter(
  tx: Pick<typeof prisma, "tenant">,
  tenantId: string,
): Promise<void> {
  await tx.tenant.update({
    where: { id: tenantId },
    data: { monthlyPartyCount: { increment: 1 } },
  });
}
