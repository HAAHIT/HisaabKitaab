"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  GR, AM, OR, PU, SG, IN, TYPE,
  fmtFull, useIsMobile, HKCard, HKToast, GradientButton,
} from "@/components/ui/hk-design";
import {
  getBalanceIndicator,
  getBalanceStatusLabel,
  type PartyLedgerEntry,
  type SupportedPartyType,
} from "@/lib/accounting";

function fmtAbs(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Math.abs(n));
}

type PartyProfile = {
  name: string;
  type: SupportedPartyType;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstin: string | null;
  openingBalance: number;
  createdAt: Date;
};

type MeasurementItem = {
  id: string;
  label: string;
  roomName: string | null;
  status: string;
  createdAt: Date;
};

type ReconcileResult = {
  total: number;
  drifted: { partyId: string; name: string; stored: number; computed: number }[];
};

export default function PartyProfileClient({
  party,
  ledger,
  measurements,
  calculatedCurrent,
  partyId,
  role,
}: {
  party: PartyProfile;
  ledger: PartyLedgerEntry[];
  measurements: MeasurementItem[];
  calculatedCurrent: number;
  partyId: string;
  role: string | null;
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [reconcileResult, setReconcileResult] = useState<ReconcileResult | null>(null);
  const [reconcileLoading, setReconcileLoading] = useState<"check" | "fix" | null>(null);
  const [reconcileError, setReconcileError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const isCustomer = party.type === "CUSTOMER";
  const accentColor = isCustomer ? PU : OR;
  const accentBg = isCustomer ? PU + "18" : OR + "18";

  const balanceColor = calculatedCurrent === 0 ? "var(--hk-sub)" : calculatedCurrent > 0 ? GR : OR;
  const balanceLabel = getBalanceStatusLabel(party.type, calculatedCurrent);
  const balanceIndicator = getBalanceIndicator(party.type, calculatedCurrent);

  async function handleCheckBalances() {
    setReconcileLoading("check");
    setReconcileError(null);
    setReconcileResult(null);
    try {
      const res = await fetch("/api/parties/reconcile");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Check failed");
      setReconcileResult(data);
    } catch (err) {
      setReconcileError(err instanceof Error ? err.message : "Check failed");
    } finally {
      setReconcileLoading(null);
    }
  }

  async function handleFixBalances() {
    setReconcileLoading("fix");
    setReconcileError(null);
    try {
      const res = await fetch("/api/parties/reconcile", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fix failed");
      setReconcileResult(null);
      router.refresh();
    } catch (err) {
      setReconcileError(err instanceof Error ? err.message : "Fix failed");
      setReconcileLoading(null);
    }
  }

  return (
    <div style={{ background: "var(--hk-bg)", minHeight: "100%", fontFamily: SG }}>
      {toast && <HKToast message={toast.message} type={toast.type} />}

      {/* Top bar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "var(--hk-nav)", borderBottom: "1px solid var(--hk-border)",
        display: "flex", alignItems: "center", gap: 12,
        padding: "0 20px", height: 57,
      }}>
        <button
          onClick={() => router.push("/parties")}
          style={{
            width: 36, height: 36, borderRadius: 10, border: "1px solid var(--hk-border)",
            background: "var(--hk-card)", display: "flex", alignItems: "center",
            justifyContent: "center", cursor: "pointer", flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--hk-text)" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: TYPE.body, fontWeight: 700, color: "var(--hk-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {party.name}
          </p>
          <p style={{ fontSize: TYPE.caption, color: "var(--hk-sub)" }}>
            {party.phone ? `+91 ${party.phone}` : party.email || "No contact"}
          </p>
        </div>
        <span style={{
          fontSize: TYPE.chip, fontWeight: 700, color: accentColor,
          background: accentBg, padding: "4px 10px", borderRadius: 7,
          whiteSpace: "nowrap", flexShrink: 0,
        }}>
          {isCustomer ? "Customer" : "Vendor"}
        </span>
      </div>

      <div style={{ padding: isMobile ? "16px 14px" : "20px 28px", maxWidth: 1200, margin: "0 auto" }}>

        {/* Balance hero */}
        <HKCard style={{ marginBottom: 16, borderLeft: `4px solid ${balanceColor}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <p style={{ fontSize: TYPE.caption, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--hk-sub)", marginBottom: 4 }}>
                Current Balance
              </p>
              <p style={{ fontSize: isMobile ? 28 : TYPE.numLarge, fontWeight: 800, color: balanceColor, fontFamily: IN }}>
                {fmtAbs(calculatedCurrent)}
              </p>
              <p style={{ fontSize: TYPE.bodySmall, color: "var(--hk-sub)", marginTop: 4 }}>
                {balanceLabel}{balanceIndicator ? ` · ${balanceIndicator}` : ""}
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => router.push(`/bills/new?partyId=${partyId}`)}
                style={{
                  padding: "10px 18px", borderRadius: 12,
                  background: OR + "18", border: `1.5px solid ${OR}44`,
                  color: OR, fontFamily: SG, fontSize: TYPE.bodySmall,
                  fontWeight: 700, cursor: "pointer",
                }}
              >
                {t("bills.new")}
              </button>
              <GradientButton onClick={() => router.push(`/payments/new?partyId=${partyId}`)}>
                {t("payments.record")}
              </GradientButton>
            </div>
          </div>
        </HKCard>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 360px", gap: 16 }}>

          {/* Ledger (left) */}
          <HKCard style={{ padding: 0 }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--hk-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: TYPE.label, fontWeight: 700, color: "var(--hk-text)" }}>{t("khata.ledgerTitle")}</p>
                <p style={{ fontSize: TYPE.caption, color: "var(--hk-sub)" }}>{party.phone ? `+91 ${party.phone}` : party.name}</p>
              </div>
              <span style={{
                fontSize: TYPE.bodySmall, fontWeight: 700,
                color: calculatedCurrent >= 0 ? GR : OR,
                background: calculatedCurrent >= 0 ? GR + "18" : OR + "18",
                padding: "4px 10px", borderRadius: 8,
              }}>
                {fmtAbs(calculatedCurrent)}
                {balanceIndicator ? ` (${balanceIndicator})` : ""}
              </span>
            </div>

            <div style={{ maxHeight: "60vh", overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
              {ledger.map((entry) => {
                const isOpening = entry.type === "OPENING";
                const isDebit = entry.debit > 0;
                const amount = isDebit ? `-${fmtAbs(entry.debit)}` : entry.credit > 0 ? `+${fmtAbs(entry.credit)}` : fmtAbs(0);
                const entryColor = isOpening ? "var(--hk-sub)" : isDebit ? OR : GR;
                const entryBg = isOpening ? "var(--hk-badge)" : isDebit ? OR + "12" : GR + "12";

                return (
                  <div
                    key={entry.id}
                    style={{ display: "flex", justifyContent: isOpening ? "center" : isDebit ? "flex-start" : "flex-end" }}
                  >
                    <div style={{
                      maxWidth: "88%", borderRadius: 16, padding: "12px 14px",
                      background: entryBg, border: isOpening ? "1px solid var(--hk-border)" : "none",
                    }}>
                      <p style={{ fontSize: TYPE.caption, color: "var(--hk-sub)", marginBottom: 4 }}>
                        {new Date(entry.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        {" · "}{entry.type}
                      </p>
                      {entry.link ? (
                        <button
                          onClick={() => router.push(entry.link!)}
                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: SG, fontSize: TYPE.body, fontWeight: 700, color: PU, textDecoration: "underline" }}
                        >
                          {entry.description}
                        </button>
                      ) : (
                        <p style={{ fontSize: TYPE.body, fontWeight: 700, color: "var(--hk-text)" }}>{entry.description}</p>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 6, gap: 16 }}>
                        <p style={{ fontSize: TYPE.caption, color: "var(--hk-sub)" }}>
                          {t("khata.balanceAfter")} {fmtAbs(entry.balanceAfter)}
                          {getBalanceIndicator(party.type, entry.balanceAfter) ? ` (${getBalanceIndicator(party.type, entry.balanceAfter)})` : ""}
                        </p>
                        <p style={{ fontSize: TYPE.numSmall, fontWeight: 800, color: entryColor, fontFamily: IN }}>{amount}</p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {ledger.length <= 1 && (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--hk-sub)", fontSize: TYPE.body }}>
                  {t("khata.noTransactions")}
                </div>
              )}
            </div>
          </HKCard>

          {/* Right column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Party details */}
            <HKCard>
              <p style={{ fontSize: TYPE.label, fontWeight: 700, color: "var(--hk-text)", marginBottom: 14 }}>Party Details</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { label: "Address", value: party.address },
                  { label: "GSTIN", value: party.gstin, mono: true },
                  { label: "Email", value: party.email },
                  {
                    label: "Opening Balance",
                    value: party.openingBalance !== 0
                      ? `${party.openingBalance > 0 ? "+" : ""}${fmtAbs(party.openingBalance)}`
                      : "₹0",
                  },
                  { label: "Registered", value: new Date(party.createdAt).toLocaleDateString("en-IN") },
                ].map(({ label, value, mono }) => (
                  <div key={label}>
                    <p style={{ fontSize: TYPE.caption, color: "var(--hk-sub)", marginBottom: 2 }}>{label}</p>
                    <p style={{ fontSize: TYPE.bodySmall, fontWeight: 600, color: "var(--hk-text)", fontFamily: mono ? IN : SG }}>
                      {value || "Not provided"}
                    </p>
                  </div>
                ))}
              </div>
            </HKCard>

            {/* Measurements (customers only) */}
            {isCustomer && measurements.length > 0 && (
              <HKCard>
                <p style={{ fontSize: TYPE.label, fontWeight: 700, color: "var(--hk-text)", marginBottom: 14 }}>Measurements</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {measurements.map((m) => (
                    <div key={m.id} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "10px 12px", borderRadius: 10, border: "1px solid var(--hk-border)",
                      background: "var(--hk-badge)",
                    }}>
                      <div>
                        <p style={{ fontSize: TYPE.bodySmall, fontWeight: 700, color: "var(--hk-text)" }}>{m.label}</p>
                        <p style={{ fontSize: TYPE.caption, color: "var(--hk-sub)" }}>
                          {m.roomName || "Unspecified"} · {new Date(m.createdAt).toLocaleDateString("en-IN")}
                        </p>
                      </div>
                      <span style={{
                        fontSize: TYPE.chip, fontWeight: 700, color: GR,
                        background: GR + "18", padding: "3px 8px", borderRadius: 6,
                      }}>
                        {m.status}
                      </span>
                    </div>
                  ))}
                </div>
              </HKCard>
            )}

            {/* Balance health (admin only) */}
            {role === "ADMIN" && (
              <HKCard>
                <p style={{ fontSize: TYPE.label, fontWeight: 700, color: "var(--hk-text)", marginBottom: 6 }}>Balance Health</p>
                <p style={{ fontSize: TYPE.caption, color: "var(--hk-sub)", marginBottom: 12 }}>
                  Verify all party balances match journal history.
                </p>

                {reconcileError && (
                  <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 8, background: OR + "18", border: `1px solid ${OR}44`, fontSize: TYPE.caption, color: OR }}>
                    {reconcileError}
                  </div>
                )}

                {reconcileResult && (
                  <div style={{ marginBottom: 12 }}>
                    {reconcileResult.drifted.length === 0 ? (
                      <div style={{ padding: "8px 12px", borderRadius: 8, background: GR + "18", fontSize: TYPE.caption, fontWeight: 700, color: GR }}>
                        All {reconcileResult.total} balances are correct ✓
                      </div>
                    ) : (
                      <>
                        <div style={{ padding: "8px 12px", borderRadius: 8, background: AM + "18", fontSize: TYPE.caption, fontWeight: 700, color: AM, marginBottom: 8 }}>
                          {reconcileResult.drifted.length} of {reconcileResult.total} parties have drift
                        </div>
                        <div style={{ maxHeight: 140, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                          {reconcileResult.drifted.map((d) => (
                            <div key={d.partyId} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--hk-border)", fontSize: TYPE.caption }}>
                              <p style={{ fontWeight: 700, color: "var(--hk-text)" }}>{d.name}</p>
                              <p style={{ color: "var(--hk-sub)", marginTop: 2 }}>
                                Stored: {fmtAbs(d.stored)} → Actual: {fmtAbs(d.computed)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={handleCheckBalances}
                    disabled={reconcileLoading !== null}
                    style={{
                      flex: 1, padding: "9px 0", borderRadius: 10, border: "1px solid var(--hk-border)",
                      background: "var(--hk-badge)", color: "var(--hk-text)", fontFamily: SG,
                      fontSize: TYPE.bodySmall, fontWeight: 600, cursor: reconcileLoading ? "not-allowed" : "pointer",
                      opacity: reconcileLoading ? 0.6 : 1,
                    }}
                  >
                    {reconcileLoading === "check" ? "Checking..." : "Check"}
                  </button>
                  {reconcileResult && reconcileResult.drifted.length > 0 && (
                    <button
                      onClick={handleFixBalances}
                      disabled={reconcileLoading !== null}
                      style={{
                        flex: 1, padding: "9px 0", borderRadius: 10, border: `1px solid ${AM}44`,
                        background: AM + "18", color: AM, fontFamily: SG,
                        fontSize: TYPE.bodySmall, fontWeight: 700, cursor: reconcileLoading ? "not-allowed" : "pointer",
                        opacity: reconcileLoading ? 0.6 : 1,
                      }}
                    >
                      {reconcileLoading === "fix" ? "Fixing..." : "Fix All"}
                    </button>
                  )}
                </div>
              </HKCard>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
