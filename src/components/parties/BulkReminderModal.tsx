"use client";

import { useEffect, useState } from "react";
import { HKButton } from "@/components/ui/HKButton";
import { C, GR, SG, IN, TYPE, fmtFull, useIsMobile } from "@/components/ui/hk-design";
import type { ReminderLanguage } from "@/lib/phone";

interface OverdueParty {
  id: string;
  name: string;
  phone: string;
  balanceAmount: number;
  waUrl: string;
}

interface Props {
  onClose: () => void;
}

const LANGUAGE_LABELS: Record<ReminderLanguage, string> = {
  hinglish: "Hinglish",
  hindi: "हिंदी",
  english: "English",
};

export function BulkReminderModal({ onClose }: Props) {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [parties, setParties] = useState<OverdueParty[]>([]);
  const [language, setLanguage] = useState<ReminderLanguage>("hinglish");
  const [totalAmount, setTotalAmount] = useState(0);
  const [error, setError] = useState("");
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [savingLang, setSavingLang] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/parties/remind-overdue", { method: "POST" });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Failed to load overdue parties");
        }
        const data = await res.json();
        setParties(data.parties || []);
        setLanguage(data.language || "hinglish");
        setTotalAmount(data.totalAmount || 0);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Could not load overdue data");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  async function handleLanguageChange(lang: ReminderLanguage) {
    setSavingLang(true);
    try {
      // Persist language preference on Tenant via settings endpoint (async, non-blocking)
      fetch("/api/settings/reminder-language", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reminderLanguage: lang }),
      }).catch(() => {}); // Ignore save errors — language changed locally is fine

      // Rebuild wa.me URLs client-side without re-fetching party list (saves round-trip)
      const { buildWhatsAppReminderUrl } = await import("@/lib/phone");
      const tenantName = parties[0]?.name ? parties[0].name.split(" ")[0] : undefined; // Approximate tenant name
      const updatedParties = parties.map((p) => ({
        ...p,
        waUrl: buildWhatsAppReminderUrl({
          phone: p.phone,
          partyName: p.name,
          balanceAmount: p.balanceAmount,
          tenantName,
          language: lang,
        }),
      }));

      setParties(updatedParties);
      setLanguage(lang);
      setSentIds(new Set()); // reset sent tracking on language switch
    } catch {
      // Non-critical — URL rebuild failed, keep showing modal with old URLs
    } finally {
      setSavingLang(false);
    }
  }

  function openReminder(party: OverdueParty) {
    window.open(party.waUrl, "_blank", "noopener,noreferrer");
    setSentIds((prev) => new Set(prev).add(party.id));
  }

  function sendAll() {
    // Open URLs sequentially with 200ms delay to work around pop-up blocking
    // (browsers allow pop-ups if they're triggered by user interaction)
    parties.forEach((party, idx) => {
      setTimeout(() => {
        window.open(party.waUrl, "_blank", "noopener,noreferrer");
      }, idx * 200);
    });
    setSentIds(new Set(parties.map((p) => p.id)));
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          zIndex: 599,
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: isMobile ? 0 : "50%",
          left: isMobile ? 0 : "50%",
          right: isMobile ? 0 : undefined,
          bottom: isMobile ? 0 : undefined,
          transform: isMobile ? "none" : "translate(-50%, -50%)",
          width: isMobile ? "100%" : 520,
          maxHeight: isMobile ? "100%" : "85vh",
          zIndex: 600,
          display: "flex",
          flexDirection: "column",
          background: "var(--sb-card)",
          borderRadius: isMobile ? 0 : 20,
          border: "1px solid var(--sb-border)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.3)",
          fontFamily: SG,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 20px",
            borderBottom: "1px solid var(--sb-border)",
            flexShrink: 0,
          }}
        >
          <div>
            <h2 style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--sb-text)", margin: 0, fontFamily: SG }}>
              📲 Month-End Reminders
            </h2>
            <p style={{ fontSize: TYPE.caption, color: "var(--sb-muted)", marginTop: 3, fontFamily: SG }}>
              {loading ? "Loading…" : `${parties.length} overdue customers · ${fmtFull(totalAmount)} pending`}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 34, height: 34, borderRadius: 9,
              border: "1px solid var(--sb-border)",
              background: "var(--sb-surface-alt)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "var(--sb-sub)", flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Language toggle */}
        <div
          style={{
            padding: "12px 20px",
            borderBottom: "1px solid var(--sb-border)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: TYPE.bodySmall, fontWeight: 600, color: "var(--sb-muted)", fontFamily: SG }}>
            Message language:
          </span>
          {(["hinglish", "hindi", "english"] as ReminderLanguage[]).map((lang) => (
            <button
              key={lang}
              onClick={() => handleLanguageChange(lang)}
              disabled={savingLang}
              style={{
                padding: "5px 14px",
                borderRadius: 20,
                fontSize: TYPE.bodySmall,
                fontWeight: 600,
                fontFamily: SG,
                cursor: savingLang ? "not-allowed" : "pointer",
                border: `1px solid ${language === lang ? C.primary : "var(--sb-border)"}`,
                background: language === lang ? C.primarySoft : "transparent",
                color: language === lang ? C.primary : "var(--sb-muted)",
                transition: "all 0.15s",
              }}
            >
              {LANGUAGE_LABELS[lang]}
            </button>
          ))}
        </div>

        {/* Party list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {loading ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--sb-muted)", fontFamily: SG }}>
              Loading overdue customers…
            </div>
          ) : error ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: C.negative, fontFamily: SG }}>
              {error}
            </div>
          ) : parties.length === 0 ? (
            <div style={{ padding: "48px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
              <p style={{ fontSize: TYPE.body, fontWeight: 700, color: "var(--sb-text)", fontFamily: SG }}>
                No overdue customers!
              </p>
              <p style={{ fontSize: TYPE.bodySmall, color: "var(--sb-muted)", fontFamily: SG, marginTop: 4 }}>
                All your customers are settled.
              </p>
            </div>
          ) : (
            parties.map((party) => {
              const sent = sentIds.has(party.id);
              return (
                <div
                  key={party.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 20px",
                    borderBottom: "1px solid var(--sb-divider)",
                    background: sent ? "rgba(37,211,102,0.06)" : "transparent",
                  }}
                >
                  {/* Avatar */}
                  <div
                    style={{
                      width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                      background: C.primarySoft,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 16, fontWeight: 700, color: C.primary, fontFamily: SG,
                    }}
                  >
                    {party.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: TYPE.body, fontWeight: 700, color: "var(--sb-text)", fontFamily: SG, margin: 0 }}>
                      {party.name}
                      {sent && (
                        <span style={{ marginLeft: 8, fontSize: 11, color: "#25D366", fontWeight: 600 }}>✓ Sent</span>
                      )}
                    </p>
                    <p style={{ fontSize: TYPE.caption, color: "var(--sb-muted)", margin: "2px 0 0", fontFamily: SG }}>
                      {party.phone}
                    </p>
                  </div>

                  {/* Amount */}
                  <div style={{ textAlign: "right", marginRight: 8, flexShrink: 0 }}>
                    <p style={{ fontFamily: IN, fontWeight: 700, fontSize: 15, color: GR, margin: 0, fontVariantNumeric: "tabular-nums" }}>
                      {fmtFull(party.balanceAmount)}
                    </p>
                  </div>

                  {/* WhatsApp button */}
                  <button
                    onClick={() => openReminder(party)}
                    title={`Send WhatsApp reminder to ${party.name}`}
                    style={{
                      width: 36, height: 36, borderRadius: 10,
                      border: `1px solid ${sent ? "#25D366" : "var(--sb-border)"}`,
                      background: sent ? "rgba(37,211,102,0.1)" : "var(--sb-surface-alt)",
                      color: "#25D366",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", flexShrink: 0,
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                      <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 01-4.243-1.214l-.257-.154-2.952.877.877-2.952-.154-.257A8 8 0 1112 20z" />
                    </svg>
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {!loading && parties.length > 0 && (
          <div
            style={{
              padding: "14px 20px",
              borderTop: "1px solid var(--sb-border)",
              display: "flex",
              gap: 10,
              flexShrink: 0,
              alignItems: "center",
            }}
          >
            <p style={{ flex: 1, fontSize: TYPE.caption, color: "var(--sb-muted)", fontFamily: SG }}>
              {sentIds.size}/{parties.length} reminders sent
            </p>
            <HKButton variant="secondary" onClick={onClose}>Done</HKButton>
            <HKButton
              onClick={sendAll}
              style={{ background: "#25D366", color: "#fff" }}
              title="Open all WhatsApp reminder links at once"
            >
              Send All ({parties.length})
            </HKButton>
          </div>
        )}
      </div>
    </>
  );
}
