"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HKButton } from "@/components/ui/HKButton";
import { OR, PU, GR, SG, TYPE } from "@/components/ui/hk-design";
import type { TenantPlan } from "@prisma/client";
import { useConfirm } from "@/contexts/ConfirmContext";

interface BillingStatus {
  plan: TenantPlan;
  effectivePlan: TenantPlan;
  label: string;
  subscriptionStatus: string;
  planExpiresAt: string | null;
  trial: {
    active: boolean;
    endsAt: string | null;
    daysLeft: number;
  };
  usage: {
    bills:   { used: number; limit: number | null };
    parties: { used: number; limit: number | null };
  };
}

const PLANS = [
  {
    id: "FREE" as TenantPlan,
    label: "Chhota",
    tagline: "For new dukaans",
    price: "Free",
    suffix: "",
    features: [
      "100 bills per month",
      "Up to 50 parties",
      "WhatsApp bill share + UPI link",
      "Udhar Khata for 50 parties",
      "1 user",
    ],
  },
  {
    id: "PRO" as TenantPlan,
    label: "Pakka",
    tagline: "Most popular",
    price: "₹299",
    suffix: "/month",
    accent: true,
    features: [
      "Unlimited bills & parties",
      "Tally XML export + import",
      "Excel reports (trial balance, ledger)",
      "Credit notes & payment vouchers",
      "Bank reconciliation",
      "Purchase bill OCR",
      "GST returns (3B, 1)",
      "Accountant role · Hindi/English",
    ],
  },
  {
    id: "PRO_PLUS" as TenantPlan,
    label: "Bada",
    tagline: "Multi-shop",
    price: "₹799",
    suffix: "/month",
    features: [
      "Everything in Pakka",
      "Multi-shop / multi-outlet",
      "CA portal access",
      "Custom Tally ledger mapping",
      "Priority support",
      "Unlimited users",
    ],
  },
];

export default function BillingPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/status");
      if (res.ok) {
        setStatus(await res.json());
      } else {
        setError("Could not load billing status.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function subscribe(plan: "PRO" | "PRO_PLUS", cycle: "monthly" | "yearly") {
    setActionLoading(`${plan}:${cycle}`);
    setError(null);
    try {
      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, cycle }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not start subscription.");
        return;
      }
      if (data.checkoutUrl) {
        // Razorpay hosted checkout — open in same window
        window.location.href = data.checkoutUrl;
      } else {
        setError("Subscription could not be started. Please try again or contact support.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setActionLoading(null);
    }
  }

  async function cancel() {
    if (!(await confirm({ message: "Cancel subscription? You will keep access until the end of the current billing cycle.", confirmLabel: "Cancel subscription", cancelLabel: "Keep subscription", intent: "danger" }))) return;
    setActionLoading("cancel");
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      if (res.ok) {
        await load();
      } else {
        const data = await res.json();
        setError(data.error || "Could not cancel.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error. Please try again.");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 40, fontFamily: SG, color: "var(--sb-sub)" }}>Loading billing…</div>
    );
  }

  if (!status) {
    return (
      <div style={{ padding: 40, fontFamily: SG }}>
        <p style={{ color: "var(--sb-negative)" }}>{error ?? "No billing data."}</p>
      </div>
    );
  }

  const currentLabel = status.label;
  const isPaid = status.plan !== "FREE";
  const willCancel = status.subscriptionStatus === "CANCELLED" && status.planExpiresAt;

  return (
    <div style={{ padding: "24px 20px", maxWidth: 1100, margin: "0 auto", fontFamily: SG }}>
      <h1 style={{ fontSize: TYPE.h1, fontWeight: 800, color: "var(--sb-text)", margin: 0 }}>
        Billing & Plan
      </h1>
      <p style={{ fontSize: TYPE.body, color: "var(--sb-sub)", marginTop: 4 }}>
        Manage your subscription, view usage, and upgrade.
      </p>

      {/* ── Current plan card ──────────────────────────────────────────── */}
      <div style={{
        marginTop: 24,
        padding: "20px 24px",
        borderRadius: 16,
        background: `linear-gradient(135deg, ${OR}0a, ${PU}0a)`,
        border: `1.5px solid ${OR}33`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <p style={{ fontSize: TYPE.caption, fontWeight: 700, color: OR, letterSpacing: 1, textTransform: "uppercase", margin: 0 }}>
              Current plan
            </p>
            <h2 style={{ fontSize: TYPE.h2, fontWeight: 800, color: "var(--sb-text)", margin: "4px 0 0" }}>
              {currentLabel}
              {status.trial.active && (
                <span style={{ marginLeft: 10, fontSize: TYPE.caption, fontWeight: 700, color: GR, background: GR + "1a", padding: "3px 8px", borderRadius: 999 }}>
                  TRIAL · {status.trial.daysLeft}d left
                </span>
              )}
            </h2>
            {willCancel && (
              <p style={{ fontSize: TYPE.bodySmall, color: OR, marginTop: 6 }}>
                Cancellation scheduled — active until {new Date(status.planExpiresAt!).toLocaleDateString("en-IN")}
              </p>
            )}
            {isPaid && !willCancel && status.planExpiresAt && (
              <p style={{ fontSize: TYPE.bodySmall, color: "var(--sb-sub)", marginTop: 6 }}>
                Renews on {new Date(status.planExpiresAt).toLocaleDateString("en-IN")}
              </p>
            )}
          </div>
          {isPaid && status.subscriptionStatus === "ACTIVE" && (
            <HKButton variant="secondary" size="sm" onClick={cancel} isLoading={actionLoading === "cancel"}>
              Cancel subscription
            </HKButton>
          )}
        </div>

        {/* Usage bars */}
        <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <UsageBar label="Bills this month" used={status.usage.bills.used} limit={status.usage.bills.limit} />
          <UsageBar label="Parties" used={status.usage.parties.used} limit={status.usage.parties.limit} />
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 10, background: OR + "12", border: `1px solid ${OR}33`, color: OR, fontSize: TYPE.bodySmall, fontWeight: 600 }}>
          ⚠ {error}
        </div>
      )}

      {/* ── Plan comparison ────────────────────────────────────────────── */}
      <h2 style={{ fontSize: TYPE.h2, fontWeight: 800, color: "var(--sb-text)", marginTop: 36 }}>
        Plans
      </h2>

      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        {PLANS.map((plan) => {
          const isCurrent = status.plan === plan.id;
          return (
            <div key={plan.id} style={{
              padding: 24,
              borderRadius: 16,
              border: plan.accent ? `2px solid ${OR}` : "1.5px solid var(--sb-border)",
              background: "var(--sb-card)",
              position: "relative",
            }}>
              {plan.accent && (
                <span style={{ position: "absolute", top: -10, left: 20, background: OR, color: "white", fontSize: 10, fontWeight: 700, padding: "2px 10px", borderRadius: 999, letterSpacing: 0.8, textTransform: "uppercase" }}>
                  {plan.tagline}
                </span>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <h3 style={{ fontSize: TYPE.h3, fontWeight: 800, color: "var(--sb-text)", margin: 0 }}>{plan.label}</h3>
                {!plan.accent && (
                  <span style={{ fontSize: 10, color: "var(--sb-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>{plan.tagline}</span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 12 }}>
                <span style={{ fontSize: 36, fontWeight: 800, color: "var(--sb-text)" }}>{plan.price}</span>
                {plan.suffix && <span style={{ fontSize: 14, color: "var(--sb-muted)" }}>{plan.suffix}</span>}
              </div>

              <ul style={{ listStyle: "none", padding: 0, margin: "20px 0 0", display: "grid", gap: 10 }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "var(--sb-text)" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={GR} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 3, flexShrink: 0 }}>
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <div style={{ marginTop: 24 }}>
                {isCurrent ? (
                  <button disabled style={{
                    width: "100%", padding: 12, borderRadius: 10,
                    border: "1px solid var(--sb-border)", background: "var(--sb-surface-alt)",
                    color: "var(--sb-sub)", fontSize: 14, fontWeight: 700, fontFamily: SG,
                    cursor: "default",
                  }}>
                    Current plan
                  </button>
                ) : plan.id === "FREE" ? (
                  <button disabled style={{
                    width: "100%", padding: 12, borderRadius: 10,
                    border: "1px solid var(--sb-border)", background: "transparent",
                    color: "var(--sb-muted)", fontSize: 14, fontWeight: 600, fontFamily: SG,
                    cursor: "default",
                  }}>
                    {isPaid ? "Downgrade by cancelling" : "—"}
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <HKButton
                      variant={plan.accent ? "primary" : "secondary"}
                      size="md"
                      onClick={() => subscribe(plan.id as "PRO" | "PRO_PLUS", "monthly")}
                      isLoading={actionLoading === `${plan.id}:monthly`}
                      isDisabled={!!actionLoading}
                    >
                      Monthly
                    </HKButton>
                    <HKButton
                      variant="secondary"
                      size="md"
                      onClick={() => subscribe(plan.id as "PRO" | "PRO_PLUS", "yearly")}
                      isLoading={actionLoading === `${plan.id}:yearly`}
                      isDisabled={!!actionLoading}
                    >
                      Yearly · 2 mo free
                    </HKButton>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ marginTop: 20, fontSize: 12, color: "var(--sb-muted)", textAlign: "center" }}>
        No setup fees. Cancel anytime — your data stays yours, exported as Tally XML.
      </p>
    </div>
  );
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const near = pct >= 80;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--sb-sub)" }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: near ? OR : "var(--sb-text)" }}>
          {used}{limit ? ` / ${limit}` : " · unlimited"}
        </span>
      </div>
      {limit && (
        <div style={{ height: 6, background: "var(--sb-border)", borderRadius: 999, overflow: "hidden" }}>
          <div style={{
            width: `${pct}%`,
            height: "100%",
            background: near ? OR : `linear-gradient(90deg, ${GR}, ${PU})`,
            transition: "width 0.3s",
          }} />
        </div>
      )}
    </div>
  );
}
