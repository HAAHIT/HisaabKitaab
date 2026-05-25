"use client";

import { useRouter } from "next/navigation";
import { HKModal } from "@/components/ui/hk-design";
import { HKButton } from "@/components/ui/HKButton";
import { OR, PU, GR, SG, TYPE } from "@/components/ui/hk-design";

interface QuotaExceededModalProps {
  isOpen: boolean;
  onClose: () => void;
  resource: "bills" | "parties";
  used: number;
  limit: number;
}

/**
 * Modal shown when an API call returns 402 PAYMENT_REQUIRED with
 * `code: "QUOTA_EXCEEDED"`. Tells the user which limit was hit and
 * routes them to the billing page.
 *
 * Usage from any client component:
 *   const res = await fetch("/api/bills", { method: "POST", body });
 *   if (res.status === 402) {
 *     const data = await res.json();
 *     setQuotaModal({ open: true, ...data.quota });
 *     return;
 *   }
 */
export function QuotaExceededModal({
  isOpen,
  onClose,
  resource,
  used,
  limit,
}: QuotaExceededModalProps) {
  const router = useRouter();

  const resourceLabel = resource === "bills" ? "monthly bills" : "parties";
  const headline = resource === "bills"
    ? "Monthly bill limit reached"
    : "Party limit reached";

  return (
    <HKModal
      isOpen={isOpen}
      onClose={onClose}
      title={headline}
      footer={
        <>
          <HKButton variant="secondary" onClick={onClose}>
            Not now
          </HKButton>
          <HKButton
            variant="primary"
            onClick={() => {
              onClose();
              router.push("/settings/billing");
            }}
          >
            Upgrade to Pakka — ₹299/mo
          </HKButton>
        </>
      }
    >
      <div style={{ fontFamily: SG }}>
        {/* Usage bar */}
        <div style={{
          background: "var(--sb-surface-alt)",
          borderRadius: 12,
          padding: "16px 18px",
          marginBottom: 16,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: TYPE.bodySmall, color: "var(--sb-sub)", fontWeight: 600 }}>
              {resourceLabel} used this month
            </span>
            <span style={{ fontSize: TYPE.bodySmall, fontWeight: 700, color: OR }}>
              {used} / {limit}
            </span>
          </div>
          <div style={{
            height: 6,
            background: "var(--sb-border)",
            borderRadius: 999,
            overflow: "hidden",
          }}>
            <div style={{
              width: "100%",
              height: "100%",
              background: `linear-gradient(90deg, ${OR}, ${PU})`,
            }} />
          </div>
        </div>

        <p style={{ fontSize: TYPE.body, color: "var(--sb-text)", lineHeight: 1.6, marginBottom: 12 }}>
          You&apos;re on the <strong>Chhota</strong> (free) plan, which includes {limit} {resourceLabel}.
          Upgrade to <strong>Pakka</strong> for unlimited {resourceLabel}, plus Tally export,
          Excel reports, GST returns, and bank reconciliation.
        </p>

        {/* Pakka features quick list */}
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
          {[
            "Unlimited bills & parties",
            "Tally XML export + import",
            "Excel reports for your CA",
            "Bank reconciliation",
            "Purchase bill OCR",
          ].map((feature) => (
            <li key={feature} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke={GR} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13l4 4L19 7" />
              </svg>
              <span style={{ fontSize: TYPE.bodySmall, color: "var(--sb-text)" }}>{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </HKModal>
  );
}
