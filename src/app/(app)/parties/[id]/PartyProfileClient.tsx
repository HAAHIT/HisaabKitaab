"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { type TranslationKey } from "@/lib/i18n/translations";
import {
  C, GR, AM, SG, TYPE, FONT, MONO, RADIUS,
  typo, fmtFull, useIsMobile, HKCard, HKAvatar, HKChip, StatusChip,
} from "@/components/ui/hk-design";
import { HKButton } from "@/components/ui/HKButton";
import {
  getBalanceStatusLabel,
  type SupportedPartyType,
} from "@/lib/accounting";

function fmtAbs(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n));
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

type BillItem = {
  id: string;
  billNumber: string;
  status: string;
  grandTotal: number;
  createdAt: Date;
};

type PaymentItem = {
  id: string;
  direction: string;
  mode: string;
  date: Date;
  amount: number;
};

type ReconcileResult = {
  total: number;
  drifted: { partyId: string; name: string; stored: number; computed: number }[];
};

export default function PartyProfileClient({
  party,
  measurements,
  calculatedCurrent,
  partyId,
  role,
  billsList,
  paymentsList,
}: {
  party: PartyProfile;
  measurements: MeasurementItem[];
  calculatedCurrent: number;
  partyId: string;
  role: string | null;
  billsList: BillItem[];
  paymentsList: PaymentItem[];
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [reconcileResult, setReconcileResult] = useState<ReconcileResult | null>(null);
  const [reconcileLoading, setReconcileLoading] = useState<"check" | "fix" | null>(null);
  const [reconcileError, setReconcileError] = useState<string | null>(null);
  const isCustomer = party.type === "CUSTOMER";

  const balanceColor = calculatedCurrent === 0 ? "var(--sb-sub)" : calculatedCurrent > 0 ? GR : C.negative;
  const rawBalanceLabel = getBalanceStatusLabel(party.type, calculatedCurrent);
  const balanceLabel =
    rawBalanceLabel === "settled" ? t("khata.settled" as TranslationKey) :
    rawBalanceLabel === "advance balance" ? t("khata.advance" as TranslationKey) :
    rawBalanceLabel === "to receive" ? t("khata.toReceive" as TranslationKey) :
    rawBalanceLabel === "to pay" ? t("khata.toPay" as TranslationKey) : rawBalanceLabel;

  const totalBilled = billsList
    .filter(b => b.status !== "CANCELLED")
    .reduce((s, b) => s + b.grandTotal, 0);
  const billCount = billsList.filter(b => b.status !== "CANCELLED").length;

  const lastPayment = paymentsList.length > 0 ? paymentsList[0] : null;
  const lastPayDays = lastPayment
    ? Math.floor((Date.now() - new Date(lastPayment.date).getTime()) / 86400000)
    : null;

  const waText = encodeURIComponent(
    calculatedCurrent === 0
      ? `Hi ${party.name}, your account is settled. Thank you!`
      : `Hi ${party.name}, your outstanding balance is ${fmtAbs(calculatedCurrent)}.`
  );
  // wa.me expects a digits-only number with country code. Strip non-digits;
  // only prepend 91 if the cleaned number doesn't already start with a country
  // code (10-digit local number = no country code yet).
  const waHref = (() => {
    if (!party.phone) return undefined;
    const digits = party.phone.replace(/\D/g, "");
    const withCountry = digits.length === 10 ? `91${digits}` : digits;
    return `https://wa.me/${withCountry}?text=${waText}`;
  })();

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
      // Scope the repair to THIS party only — not the whole tenant.
      const res = await fetch("/api/parties/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partyId }),
      });
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
    <div style={{ background: "var(--sb-bg)", minHeight: "100%", fontFamily: SG }}>
      <div style={{ padding: isMobile ? "14px 14px 100px" : "24px 28px", maxWidth: 1080, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button
            onClick={() => router.push("/parties")}
            style={{
              width: 36, height: 36, borderRadius: RADIUS.md, border: "1px solid var(--sb-border)",
              background: "var(--sb-card)", display: "flex", alignItems: "center",
              justifyContent: "center", cursor: "pointer", flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--sb-text)" strokeWidth="2" strokeLinecap="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <h1 style={{ ...typo("h1"), color: "var(--sb-text)", margin: 0, flex: 1 }}>
            {t("parties.detailTitle" as TranslationKey) || "Party Detail"}
          </h1>
        </div>

        {/* Profile card */}
        <HKCard style={{ marginBottom: 14 }} padding={isMobile ? 20 : 28}>
          {/* Avatar + name + chips */}
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <HKAvatar name={party.name} size={64} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h2 style={{ ...typo("h1"), color: "var(--sb-text)", margin: 0 }}>{party.name}</h2>
                <HKChip tone={isCustomer ? "info" : "warning"}>
                  {isCustomer ? t("parties.customerType" as TranslationKey) : t("parties.vendorType" as TranslationKey)}
                </HKChip>
              </div>
              <p style={{ ...typo("bodySm"), color: "var(--sb-sub)", margin: "6px 0 0" }}>
                {[party.address, party.phone].filter(Boolean).join(" · ")}
                {party.gstin && <> · <span style={{ fontFamily: MONO }}>{party.gstin}</span></>}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr 1fr",
            gap: 14, marginTop: 24,
            padding: "18px 0 0", borderTop: "1px solid var(--sb-border)",
          }}>
            <div>
              <p style={{ ...typo("caption"), color: "var(--sb-sub)", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.3px" }}>
                {t("khata.currentBalance" as TranslationKey)}
              </p>
              <p style={{
                fontFamily: FONT, fontWeight: 800,
                fontSize: isMobile ? 28 : 36, letterSpacing: "-0.8px",
                color: balanceColor, fontVariantNumeric: "tabular-nums",
              }}>
                {calculatedCurrent === 0 ? "Settled ✓" : fmtAbs(calculatedCurrent)}
              </p>
              <p style={{ ...typo("caption"), color: "var(--sb-sub)", marginTop: 2 }}>
                {calculatedCurrent !== 0 && balanceLabel}
              </p>
            </div>
            <div>
              <p style={{ ...typo("caption"), color: "var(--sb-sub)", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.3px" }}>
                Total Billed
              </p>
              <p style={{ fontFamily: FONT, fontWeight: 700, fontSize: isMobile ? 20 : 24, color: "var(--sb-text)", letterSpacing: "-0.4px", fontVariantNumeric: "tabular-nums" }}>
                {fmtFull(totalBilled)}
              </p>
              <p style={{ ...typo("caption"), color: "var(--sb-sub)", marginTop: 2 }}>{billCount} bills</p>
            </div>
            <div>
              <p style={{ ...typo("caption"), color: "var(--sb-sub)", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.3px" }}>
                Last Payment
              </p>
              <p style={{ fontFamily: FONT, fontWeight: 700, fontSize: isMobile ? 20 : 24, color: "var(--sb-text)", letterSpacing: "-0.4px", fontVariantNumeric: "tabular-nums" }}>
                {lastPayDays !== null ? `${lastPayDays} days` : "—"}
              </p>
              <p style={{ ...typo("caption"), color: "var(--sb-sub)", marginTop: 2 }}>
                {lastPayDays !== null ? "since last pay" : "no payments yet"}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
            {party.phone && (
              <a href={`tel:${party.phone}`} style={{ textDecoration: "none", display: "flex" }}>
                <HKButton variant="secondary" size="sm"
                  startContent={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.24h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l1.83-1.83a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>}
                >Call</HKButton>
              </a>
            )}
            {waHref && (
              <a href={waHref} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "flex" }}>
                <HKButton variant="secondary" size="sm"
                  style={{ color: GR, borderColor: GR + "55", background: GR + "10" }}
                  startContent={<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" /></svg>}
                >WhatsApp</HKButton>
              </a>
            )}
            {isCustomer && (
              <HKButton variant="secondary" size="sm"
                onClick={() => router.push(`/bills/new?partyId=${partyId}`)}
                startContent={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>}
              >{t("bills.new")}</HKButton>
            )}
            <HKButton size="sm" onClick={() => router.push(`/payments/new?partyId=${partyId}`)}>
              {t("payments.record")}
            </HKButton>
          </div>
        </HKCard>

        {/* Bills + Payments side by side */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 14 }}>

          {/* Bills */}
          <HKCard padding={0}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "14px 18px", borderBottom: "1px solid var(--sb-border)",
            }}>
              <p style={{ ...typo("h3"), color: "var(--sb-text)", margin: 0 }}>Bills</p>
              <span style={{ ...typo("caption"), color: "var(--sb-sub)" }}>{billsList.length}</span>
            </div>
            {billsList.length === 0 ? (
              <div style={{ padding: "32px 18px", textAlign: "center", color: "var(--sb-sub)", fontSize: TYPE.bodySmall }}>
                No bills yet
              </div>
            ) : (
              <div style={{ maxHeight: 280, overflowY: "auto" }}>
                {billsList.map((b, i) => (
                  <button
                    key={b.id}
                    onClick={() => router.push(`/bills/${b.id}`)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 18px",
                      borderBottom: i < billsList.length - 1 ? "1px solid var(--sb-border)" : "none",
                      background: "transparent", border: "none", cursor: "pointer",
                      textAlign: "left", color: "var(--sb-text)",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <span style={{ ...typo("bodySm"), fontFamily: MONO, color: "var(--sb-sub)" }}>{b.billNumber}</span>
                        <StatusChip status={b.status} />
                      </div>
                      <p style={{ ...typo("caption"), color: "var(--sb-sub)", margin: 0 }}>
                        {new Date(b.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: "var(--sb-text)", fontVariantNumeric: "tabular-nums" }}>
                      {fmtFull(b.grandTotal)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </HKCard>

          {/* Payments */}
          <HKCard padding={0}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "14px 18px", borderBottom: "1px solid var(--sb-border)",
            }}>
              <p style={{ ...typo("h3"), color: "var(--sb-text)", margin: 0 }}>Payments</p>
              <span style={{ ...typo("caption"), color: "var(--sb-sub)" }}>{paymentsList.length}</span>
            </div>
            {paymentsList.length === 0 ? (
              <div style={{ padding: "32px 18px", textAlign: "center", color: "var(--sb-sub)", fontSize: TYPE.bodySmall }}>
                No payments yet
              </div>
            ) : (
              <div style={{ maxHeight: 280, overflowY: "auto" }}>
                {paymentsList.map((p, i) => {
                  const isIncoming = p.direction === "INCOMING";
                  const dirColor = isIncoming ? GR : C.negative;
                  const dirBg = isIncoming ? GR + "18" : C.negative + "18";
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "10px 18px",
                        borderBottom: i < paymentsList.length - 1 ? "1px solid var(--sb-border)" : "none",
                      }}
                    >
                      <div style={{
                        width: 30, height: 30, borderRadius: 10,
                        background: dirBg, color: dirColor,
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}>
                        {isIncoming ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                          </svg>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ ...typo("bodySm"), color: "var(--sb-text)", fontWeight: 600, margin: 0 }}>{p.mode}</p>
                        <p style={{ ...typo("caption"), color: "var(--sb-sub)", margin: "2px 0 0" }}>
                          {new Date(p.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                      <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: dirColor, fontVariantNumeric: "tabular-nums" }}>
                        {isIncoming ? "+" : "-"}{fmtFull(p.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </HKCard>
        </div>

        {/* Bottom row: party details + measurements + reconcile */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>

          {/* Party details */}
          <HKCard>
            <p style={{ ...typo("h3"), color: "var(--sb-text)", marginBottom: 14 }}>{t("parties.detailsTitle" as TranslationKey)}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { label: t("parties.addressLabel" as TranslationKey), value: party.address },
                { label: t("parties.gstinLabel" as TranslationKey), value: party.gstin, mono: true },
                { label: t("parties.emailLabel" as TranslationKey), value: party.email },
                {
                  label: t("parties.openingBalance" as TranslationKey),
                  value: party.openingBalance !== 0
                    ? `${party.openingBalance > 0 ? "+" : ""}${fmtAbs(party.openingBalance)}`
                    : "₹0",
                },
                { label: t("parties.registered" as TranslationKey), value: new Date(party.createdAt).toLocaleDateString("en-IN") },
              ].map(({ label, value, mono }) => (
                <div key={label}>
                  <p style={{ ...typo("caption"), color: "var(--sb-sub)", marginBottom: 2 }}>{label}</p>
                  <p style={{ ...typo("bodySm"), fontWeight: 600, color: "var(--sb-text)", fontFamily: mono ? MONO : SG }}>
                    {value || t("parties.notProvided" as TranslationKey)}
                  </p>
                </div>
              ))}
            </div>
          </HKCard>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Measurements (customers only) */}
            {isCustomer && measurements.length > 0 && (
              <HKCard>
                <p style={{ ...typo("h3"), color: "var(--sb-text)", marginBottom: 14 }}>{t("parties.measurements" as TranslationKey)}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {measurements.map((m) => (
                    <div key={m.id} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "10px 12px", borderRadius: RADIUS.md, border: "1px solid var(--sb-border)",
                      background: "var(--sb-badge)",
                    }}>
                      <div>
                        <p style={{ ...typo("bodySm"), fontWeight: 700, color: "var(--sb-text)" }}>{m.label}</p>
                        <p style={{ ...typo("caption"), color: "var(--sb-sub)" }}>
                          {m.roomName || t("parties.unspecified" as TranslationKey)} · {new Date(m.createdAt).toLocaleDateString("en-IN")}
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
                <p style={{ ...typo("h3"), color: "var(--sb-text)", marginBottom: 6 }}>{t("parties.balanceHealth" as TranslationKey)}</p>
                <p style={{ ...typo("caption"), color: "var(--sb-sub)", marginBottom: 12 }}>
                  {t("parties.reconcileHelp" as TranslationKey)}
                </p>

                {reconcileError && (
                  <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: RADIUS.md, background: C.negative + "18", border: `1px solid ${C.negative}44`, fontSize: TYPE.caption, color: C.negative }}>
                    {reconcileError}
                  </div>
                )}

                {reconcileResult && (
                  <div style={{ marginBottom: 12 }}>
                    {reconcileResult.drifted.length === 0 ? (
                      <div style={{ padding: "8px 12px", borderRadius: RADIUS.md, background: GR + "18", fontSize: TYPE.caption, fontWeight: 700, color: GR }}>
                        {t("parties.allCorrect" as TranslationKey)} ({reconcileResult.total}) ✓
                      </div>
                    ) : (
                      <>
                        <div style={{ padding: "8px 12px", borderRadius: RADIUS.md, background: AM + "18", fontSize: TYPE.caption, fontWeight: 700, color: AM, marginBottom: 8 }}>
                          {reconcileResult.drifted.length} / {reconcileResult.total} {t("parties.hasDrift" as TranslationKey)}
                        </div>
                        <div style={{ maxHeight: 140, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                          {reconcileResult.drifted.map((d) => (
                            <div key={d.partyId} style={{ padding: "8px 10px", borderRadius: RADIUS.md, border: "1px solid var(--sb-border)", fontSize: TYPE.caption }}>
                              <p style={{ fontWeight: 700, color: "var(--sb-text)" }}>{d.name}</p>
                              <p style={{ color: "var(--sb-sub)", marginTop: 2 }}>
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
                      flex: 1, padding: "9px 0", borderRadius: RADIUS.md, border: "1px solid var(--sb-border)",
                      background: "var(--sb-badge)", color: "var(--sb-text)", fontFamily: SG,
                      fontSize: TYPE.bodySmall, fontWeight: 600, cursor: reconcileLoading ? "not-allowed" : "pointer",
                      opacity: reconcileLoading ? 0.6 : 1,
                    }}
                  >
                    {reconcileLoading === "check" ? t("parties.checking" as TranslationKey) : t("parties.check" as TranslationKey)}
                  </button>
                  {reconcileResult && reconcileResult.drifted.length > 0 && (
                    <button
                      onClick={handleFixBalances}
                      disabled={reconcileLoading !== null}
                      style={{
                        flex: 1, padding: "9px 0", borderRadius: RADIUS.md, border: `1px solid ${AM}44`,
                        background: AM + "18", color: AM, fontFamily: SG,
                        fontSize: TYPE.bodySmall, fontWeight: 700, cursor: reconcileLoading ? "not-allowed" : "pointer",
                        opacity: reconcileLoading ? 0.6 : 1,
                      }}
                    >
                      {reconcileLoading === "fix" ? t("parties.fixing" as TranslationKey) : t("parties.fixAll" as TranslationKey)}
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
