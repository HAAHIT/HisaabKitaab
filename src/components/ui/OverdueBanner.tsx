"use client";

// ── Overdue Banner — §5.1 PRD ────────────────────────────────────────────────
// Shared alert banner that appears on Dashboard, Bills, and Parties pages.
// Shows when any party has outstanding balance and no payment in 30+ days.

import { useRouter } from "next/navigation";
import { OR, SG, IN, TYPE, fmtFull } from "@/components/ui/hk-design";

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

  if (overdueCount === 0) return null;

  // Build the message per PRD spec
  let message: string;
  if (overdueCount === 1 && overdueParty) {
    message = `${overdueParty} ka ${fmtFull(overdueAmount)} 30 din se baaki hai`;
  } else {
    message = `${overdueCount} parties ka ${fmtFull(overdueAmount)} 30+ din se baaki hai`;
  }

  return (
    <button
      onClick={() => router.push("/parties?filter=overdue")}
      aria-label={`${overdueCount} overdue parties`}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 18px",
        borderRadius: 14,
        background: OR + "14",
        border: `1.5px solid ${OR}30`,
        cursor: "pointer",
        marginBottom: 16,
        transition: "background 0.15s, border-color 0.15s",
        textAlign: "left",
        fontFamily: SG,
      }}
    >
      {/* Warning icon */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 11,
          background: OR + "22",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={OR}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: TYPE.body,
            fontWeight: 700,
            color: OR,
            fontFamily: SG,
            lineHeight: 1.3,
          }}
        >
          {message}
        </p>
        <p
          style={{
            fontSize: TYPE.bodySmall,
            fontWeight: 500,
            color: "var(--hk-sub)",
            fontFamily: SG,
            marginTop: 3,
          }}
        >
          Tap karke dekhein →
        </p>
      </div>

      {/* Amount badge */}
      <span
        style={{
          fontSize: TYPE.numSmall,
          fontWeight: 800,
          color: OR,
          fontFamily: IN,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {fmtFull(overdueAmount)}
      </span>
    </button>
  );
}
