"use client";

import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { GR, PU, SG, TYPE, TOUCH } from "@/components/ui/hk-design";

interface BillActionBarProps {
  bill: {
    id: string;
    billNumber: string;
    customerName: string;
    grandTotal: number;
    status: string;
    customerPhone?: string | null;
    partyId?: string | null;
  };
  onShare?: () => void | Promise<void>;
}

export function BillActionBar({ bill, onShare }: BillActionBarProps) {
  const { t } = useLanguage();
  const router = useRouter();

  return (
    <div
      className="no-print"
      style={{
        position: "fixed",
        bottom: "env(safe-area-inset-bottom, 80px)",
        left: 0,
        right: 0,
        zIndex: 40,
        padding: "0 16px 16px",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          maxWidth: 640,
          margin: "0 auto",
          pointerEvents: "auto",
          display: "flex",
          gap: 8,
          padding: 8,
          borderRadius: 20,
          background: "var(--sb-card)",
          border: "1px solid var(--sb-border)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
          backdropFilter: "blur(12px)",
        }}
      >
        {bill.status !== "DRAFT" && (
          <button
            onClick={() => onShare?.()}
            style={{
              flex: 1,
              height: TOUCH.primary,
              borderRadius: 12,
              border: "1.5px solid var(--sb-border)",
              background: "transparent",
              color: PU,
              fontSize: TYPE.body,
              fontWeight: 700,
              fontFamily: SG,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
            </svg>
            {t("common.share")}
          </button>
        )}

        <button
          onClick={() => window.print()}
          style={{
            flex: 1,
            height: TOUCH.primary,
            borderRadius: 12,
            border: "1.5px solid var(--sb-border)",
            background: "transparent",
            color: "var(--sb-text)",
            fontSize: TYPE.body,
            fontWeight: 700,
            fontFamily: SG,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z" />
          </svg>
          {t("common.print")}
        </button>

        {bill.status !== "CANCELLED" && (
          <button
            onClick={() => router.push(`/payments/new?billId=${bill.id}${bill.partyId ? `&partyId=${bill.partyId}` : ""}`)}
            style={{
              flex: 1,
              height: TOUCH.primary,
              borderRadius: 12,
              border: "none",
              background: GR,
              color: "#fff",
              fontSize: TYPE.body,
              fontWeight: 700,
              fontFamily: SG,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              boxShadow: `0 4px 16px ${GR}40`,
            }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {t("payments.record")}
          </button>
        )}
      </div>
    </div>
  );
}
