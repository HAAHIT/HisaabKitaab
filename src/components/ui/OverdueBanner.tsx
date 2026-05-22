"use client";

// ── Overdue Banner — §5.1 PRD ────────────────────────────────────────────────
// Shared alert banner that appears on Dashboard, Bills, and Parties pages.
// Shows when any party has outstanding balance and no payment in 30+ days.

import { useRouter } from "next/navigation";
import { C, SG, TYPE, fmtFull } from "@/components/ui/hk-design";
import { useLanguage } from "@/contexts/LanguageContext";

interface OverdueBannerProps {
  overdueCount: number;
  overdueAmount: number;
  /** When count ≤ 3, API provides the top debtor's name */
  overdueParty?: string | null;
}

export function OverdueBanner({
  overdueCount,
  overdueAmount,
  overdueParty,
}: OverdueBannerProps) {
  const router = useRouter();
  const { t } = useLanguage();

  if (overdueCount === 0) return null;

  const sub = overdueCount === 1 && overdueParty
    ? t("dash.overdueSingle").replace("{party}", overdueParty)
    : t("dash.overdueMultiple").replace("{count}", overdueCount.toString());

  return (
    <button
      onClick={() => router.push("/parties?filter=overdue")}
      aria-label={`${overdueCount} overdue parties`}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 12,
        background: C.primarySoft,
        border: `1px solid ${C.primary}33`,
        cursor: "pointer",
        marginBottom: 16,
        transition: "border-color 0.15s",
        textAlign: "left",
        fontFamily: SG,
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = `${C.primary}66`)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = `${C.primary}33`)}
    >
      {/* Icon */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: C.primary,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: TYPE.h3, fontWeight: 700, color: C.primaryDark, fontFamily: SG, margin: 0, lineHeight: 1.3 }}>
          {t("dash.overdueAmount").replace("{amount}", fmtFull(overdueAmount))}
        </p>
        <p style={{ fontSize: TYPE.caption, fontWeight: 500, color: C.primaryDark, fontFamily: SG, margin: "2px 0 0", opacity: 0.7 }}>
          {sub}
        </p>
      </div>

      {/* CTA */}
      <span style={{ fontSize: TYPE.label, fontWeight: 700, color: C.primary, display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        {t("dash.dekho")}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 18 6-6-6-6"/>
        </svg>
      </span>
    </button>
  );
}
