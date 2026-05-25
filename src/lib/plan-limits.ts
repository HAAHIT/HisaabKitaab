/**
 * Plan limits & pricing — single source of truth for quota enforcement
 * and pricing display. Mirrors the landing page Pricing section.
 *
 * Naming follows landing copy:
 *   FREE     = "Chhota"   (₹0)
 *   PRO      = "Pakka"    (₹299/mo, ₹3,588/yr)
 *   PRO_PLUS = "Bada"     (₹799/mo per outlet)
 */

import type { TenantPlan } from "@prisma/client";

export type PlanQuota = {
  // null = unlimited
  monthlyBills: number | null;
  parties: number | null;
  users: number | null;
  // Feature flags
  tallyExport: boolean;
  tallyImport: boolean;
  excelReports: boolean;
  creditNotes: boolean;
  bankReconciliation: boolean;
  purchaseOcr: boolean;
  gstReturns: boolean;
  accountantRole: boolean;
  multiShop: boolean;
  customTallyLedgerMapping: boolean;
  prioritySupport: boolean;
  // Display
  label: string;        // marketing name (Chhota / Pakka / Bada)
  monthlyPaise: number; // price in paise (0 for FREE)
  yearlyPaise: number;  // annual price in paise
};

export const PLAN_LIMITS: Record<TenantPlan, PlanQuota> = {
  FREE: {
    monthlyBills: 100,
    parties: 50,
    users: 1,
    tallyExport: false,
    tallyImport: false,
    excelReports: false,
    creditNotes: false,
    bankReconciliation: false,
    purchaseOcr: false,
    gstReturns: false,
    accountantRole: false,
    multiShop: false,
    customTallyLedgerMapping: false,
    prioritySupport: false,
    label: "Chhota",
    monthlyPaise: 0,
    yearlyPaise: 0,
  },
  PRO: {
    monthlyBills: null,
    parties: null,
    users: 3,
    tallyExport: true,
    tallyImport: true,
    excelReports: true,
    creditNotes: true,
    bankReconciliation: true,
    purchaseOcr: true,
    gstReturns: true,
    accountantRole: true,
    multiShop: false,
    customTallyLedgerMapping: false,
    prioritySupport: false,
    label: "Pakka",
    monthlyPaise: 29900,    // ₹299
    yearlyPaise: 358800,    // ₹3,588
  },
  PRO_PLUS: {
    monthlyBills: null,
    parties: null,
    users: null,
    tallyExport: true,
    tallyImport: true,
    excelReports: true,
    creditNotes: true,
    bankReconciliation: true,
    purchaseOcr: true,
    gstReturns: true,
    accountantRole: true,
    multiShop: true,
    customTallyLedgerMapping: true,
    prioritySupport: true,
    label: "Bada",
    monthlyPaise: 79900,    // ₹799 per outlet
    yearlyPaise: 958800,    // ₹9,588 per outlet
  },
};

/**
 * Trial period for newly-registered tenants — they get PRO features
 * unlocked for this many days even on the FREE plan.
 */
export const TRIAL_DAYS = 30;

/**
 * Quota check return shape. `allowed=false` means the operation should
 * be blocked and the caller should surface the upgrade prompt.
 */
export type QuotaCheck = {
  allowed: boolean;
  used: number;
  limit: number | null;
  reason?: string;
};

/**
 * Compute the effective plan considering trial. During an active trial,
 * a FREE tenant gets PRO-level access. trialEndsAt is the source of truth.
 */
export function getEffectivePlan(
  plan: TenantPlan,
  trialEndsAt: Date | null,
): TenantPlan {
  if (plan === "FREE" && trialEndsAt && trialEndsAt.getTime() > Date.now()) {
    return "PRO";
  }
  return plan;
}

/**
 * Check whether a specific feature is enabled for a tenant.
 * Use this before exposing PRO-only UI / API routes.
 */
export function hasFeature(
  plan: TenantPlan,
  trialEndsAt: Date | null,
  feature: keyof Omit<PlanQuota, "monthlyBills" | "parties" | "users" | "label" | "monthlyPaise" | "yearlyPaise">,
): boolean {
  const effective = getEffectivePlan(plan, trialEndsAt);
  return PLAN_LIMITS[effective][feature];
}

/**
 * INR formatter for display (paise → ₹).
 */
export function formatPaise(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(paise / 100);
}
