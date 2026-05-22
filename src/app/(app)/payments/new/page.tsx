"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { type TranslationKey } from "@/lib/i18n/translations";
import {
  getBalanceStatusLabel,
  getSettlementDirectionForParty,
  type SupportedPartyType,
} from "@/lib/accounting";
import { HKSelect, HKSelectItem } from "@/components/ui/HKSelect";
import { useRouter, useSearchParams } from "next/navigation";
import { PartySearch, type PartyOption } from "@/components/ui/PartySearch";
import { BillSearch, type BillOption } from "@/components/ui/BillSearch";
import {
  GR, AM, PU, OR, SG, TYPE, DISPLAY,
  HKCard, HKToast, useIsMobile,
} from "@/components/ui/hk-design";
import { HKButton } from "@/components/ui/HKButton";
import { HKInput } from "@/components/ui/HKInput";

type BankAccount = {
  id: string;
  name: string;
  type: string;
  accountNumber: string | null;
  currentBalance: number;
};

function formatSignedBalance(value: number) {
  const v = Math.round(value * 100) / 100;
  const absolute = Math.abs(v).toLocaleString("en-IN");
  if (v === 0) return `INR ${absolute}`;
  return `+INR ${absolute}`;
}

function getTranslatedBalanceStatusLabel(label: string, t: any) {
  if (label === "settled") return t("khata.settled" as TranslationKey);
  if (label === "advance balance") return t("khata.advance" as TranslationKey);
  if (label === "to receive") return t("khata.toReceive" as TranslationKey);
  if (label === "to pay") return t("khata.toPay" as TranslationKey);
  return label;
}

function getBalanceBannerStyle(partyType: SupportedPartyType, balance: number) {
  const v = Math.round(balance * 100) / 100;
  if (v === 0) return { background: "var(--sb-badge)", color: "var(--sb-sub)" };
  if (v > 0) return { background: AM + "15", color: AM };
  return partyType === "CUSTOMER"
    ? { background: GR + "15", color: GR }
    : { background: OR + "15", color: OR };
}

function sanitizeAmountInput(value: string) {
  const normalized = value.replace(/[^\d.]/g, "");
  const parts = normalized.split(".");
  const integerPart = parts[0].slice(0, 12);
  if (parts.length === 1) return integerPart;
  return `${integerPart}.${parts.slice(1).join("").slice(0, 2)}`;
}

async function readError(response: Response) {
  const data = await response.json().catch(() => null);
  return data?.error || "Request failed";
}

export default function RecordPaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const { t } = useLanguage();
  const preselectedPartyId = searchParams.get("partyId");

  const [initialParty, setInitialParty] = useState<PartyOption | null | undefined>(
    preselectedPartyId ? undefined : null
  );
  const [selectedParty, setSelectedParty] = useState<PartyOption | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const partyId = selectedParty?.id ?? "";
  const [billId, setBillId] = useState("");
  const [selectedBill, setSelectedBill] = useState<BillOption | null>(null);

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState("INCOMING");
  const [mode, setMode] = useState("BANK_TRANSFER");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("COMPLETED");
  const [paymentFlowType, setPaymentFlowType] = useState<"party" | "ledger" | "contra">("party");
  const [destinationAccountId, setDestinationAccountId] = useState("");

  useEffect(() => {
    if (!preselectedPartyId) return;
    fetch(`/api/parties/${preselectedPartyId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setInitialParty(data?.party ?? null))
      .catch(() => setInitialParty(null));
  }, [preselectedPartyId]);

  useEffect(() => {
    if (initialParty) {
      setSelectedParty(initialParty);
      setDirection(getSettlementDirectionForParty(initialParty.type as SupportedPartyType));
    }
  }, [initialParty]);

  useEffect(() => {
    async function loadAccounts() {
      try {
        const res = await fetch("/api/bank-accounts");
        if (res.ok) {
          const data = await res.json();
          setBankAccounts(data.accounts || []);
          if (data.accounts?.length > 0) {
            const first = data.accounts[0];
            setAccountId(first.id);
            setMode(first.type === "CASH" ? "CASH" : "BANK_TRANSFER");
          }
        }
      } catch {}
    }
    loadAccounts();
  }, []);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }

  async function handleSave() {
    if (paymentFlowType === "party" || paymentFlowType === "ledger") {
      if (!partyId) {
        showToast(
          paymentFlowType === "ledger"
            ? t("payments.record.toast.selectLedger" as TranslationKey)
            : t("payments.record.toast.selectParty" as TranslationKey),
          "error"
        );
        return;
      }
    } else {
      if (!accountId || !destinationAccountId) {
        showToast(t("payments.record.toast.selectSourceDest" as TranslationKey), "error");
        return;
      }
      if (accountId === destinationAccountId) {
        showToast(t("payments.record.toast.sameAccounts" as TranslationKey), "error");
        return;
      }
    }

    if (!amount || parseFloat(amount) <= 0) {
      showToast(t("payments.record.toast.invalidAmount" as TranslationKey), "error");
      return;
    }
    if (!accountId) {
      showToast(t("payments.record.toast.selectBankCash" as TranslationKey), "error");
      return;
    }

    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partyId: paymentFlowType === "contra" ? null : partyId,
          accountId,
          destinationAccountId: paymentFlowType === "contra" ? destinationAccountId : null,
          billId: paymentFlowType === "party" ? (billId || null) : null,
          amount: parseFloat(amount),
          type: paymentFlowType === "contra" ? "OUTGOING" : direction,
          mode,
          date,
          notes: notes.trim() || null,
          status: paymentStatus,
        }),
      });

      if (!response.ok) throw new Error(await readError(response));

      showToast(
        paymentStatus === "COMPLETED"
          ? t("payments.record.toast.recorded" as TranslationKey)
          : t("payments.record.toast.expectedSaved" as TranslationKey),
        "success"
      );
      window.setTimeout(() => router.push("/payments"), 800);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("parties.saveFailed" as TranslationKey), "error");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const partySearchReady = initialParty !== undefined;

  return (
    <div style={{ background: "var(--sb-bg)", minHeight: "100%", fontFamily: SG }}>
      {toast && <HKToast message={toast.message} type={toast.type} />}

      <div style={{ padding: isMobile ? "18px 14px 100px" : "24px 28px 80px", maxWidth: 680, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <button
            onClick={() => router.push("/payments")}
            style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              border: "1.5px solid var(--sb-border)", background: "var(--sb-card)",
              boxShadow: "var(--sb-shadow-card)", color: "var(--sb-text)",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div>
            <h1 style={{ fontFamily: DISPLAY, fontSize: isMobile ? 24 : 30, fontWeight: 600, color: "var(--sb-text)", margin: 0, letterSpacing: "-0.01em", lineHeight: 1.2 }}>
              {t("payments.record.title" as TranslationKey)}
            </h1>
            <p style={{ fontSize: 14, fontWeight: 500, color: "var(--sb-sub)", marginTop: 4 }}>
              {t("payments.record.subtitle" as TranslationKey)}
            </p>
          </div>
        </div>
        {/* Payment type tabs */}
        <div style={{ marginBottom: 20, display: "flex", gap: 4, background: "var(--sb-badge)", borderRadius: 14, padding: 4 }}>
          {(["party", "ledger", "contra"] as const).map((key) => {
            const labels = {
              party: t("payments.record.partyPayment" as TranslationKey),
              ledger: t("payments.record.expenseIncome" as TranslationKey),
              contra: t("payments.record.contra" as TranslationKey)
            };
            return (
              <button
                key={key}
                type="button"
                onClick={() => setPaymentFlowType(key)}
                style={{
                  flex: 1, padding: "8px 12px", borderRadius: 10, cursor: "pointer",
                  background: paymentFlowType === key ? "var(--sb-card)" : "transparent",
                  border: paymentFlowType === key ? "1px solid var(--sb-border)" : "1px solid transparent",
                  color: paymentFlowType === key ? "var(--sb-text)" : "var(--sb-sub)",
                  fontWeight: paymentFlowType === key ? 700 : 500,
                  fontSize: TYPE.bodySmall, fontFamily: SG,
                  boxShadow: paymentFlowType === key ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                  transition: "all 0.15s",
                }}
              >
                {labels[key]}
              </button>
            );
          })}
        </div>

        {/* Payment status */}
        <div style={{ marginBottom: 20, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
          {[
            {
              value: "COMPLETED",
              color: GR,
              label: t("payments.record.completedLabel" as TranslationKey),
              sub: t("payments.record.completedSub" as TranslationKey),
              icon: <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />,
            },
            {
              value: "EXPECTED",
              color: AM,
              label: t("payments.record.expectedLabel" as TranslationKey),
              sub: t("payments.record.expectedSub" as TranslationKey),
              icon: <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />,
            },
          ].map(({ value, color, label, sub, icon }) => {
            const active = paymentStatus === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setPaymentStatus(value)}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: 16, borderRadius: 16, cursor: "pointer", textAlign: "left",
                  border: `1.5px solid ${active ? color + "70" : "var(--sb-border)"}`,
                  background: active ? color + "12" : "var(--sb-card)",
                  boxShadow: active ? `0 8px 24px -12px ${color}80` : "none",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ borderRadius: 12, padding: 12, background: active ? color : color + "18", color: active ? "#fff" : color, flexShrink: 0 }}>
                  <svg width={24} height={24} fill="none" stroke="currentColor" viewBox="0 0 24 24">{icon}</svg>
                </div>
                <div>
                  <p style={{ fontSize: TYPE.body, fontWeight: 700, color: active ? color : "var(--sb-text)", fontFamily: SG }}>{label}</p>
                  <p style={{ fontSize: TYPE.caption, color: active ? color + "cc" : "var(--sb-sub)", fontFamily: SG, marginTop: 2 }}>{sub}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Payment details */}
        <HKCard style={{ marginBottom: 20 }}>
          <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--sb-text)", fontFamily: SG, marginBottom: 20 }}>
            {paymentFlowType === "contra" ? t("payments.record.transferDetails" as TranslationKey) : t("payments.record.paymentDetails" as TranslationKey)}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {paymentFlowType === "party" && partySearchReady && (
              <>
                <PartySearch
                  value={selectedParty?.id ?? null}
                  initialParty={initialParty}
                  onChange={(party) => {
                    setSelectedParty(party);
                    setBillId("");
                    setSelectedBill(null);
                    if (party) setDirection(getSettlementDirectionForParty(party.type as SupportedPartyType));
                  }}
                  placeholder={t("payments.record.selectParty" as TranslationKey)}
                />

                {selectedParty && (
                  <div
                    style={{
                      padding: "10px 14px", borderRadius: 10, fontSize: TYPE.bodySmall,
                      fontFamily: SG, fontWeight: 600,
                      ...getBalanceBannerStyle(selectedParty.type as SupportedPartyType, selectedParty.currentBalance),
                    }}
                  >
                    {t("payments.record.currentBalance" as TranslationKey)}{" "}
                    <strong>{formatSignedBalance(selectedParty.currentBalance)}</strong>{" "}
                    {getTranslatedBalanceStatusLabel(
                      getBalanceStatusLabel(selectedParty.type as SupportedPartyType, Math.round(selectedParty.currentBalance * 100) / 100),
                      t
                    )}
                  </div>
                )}

                <BillSearch
                  value={billId}
                  onChange={(bill) => {
                    if (bill) {
                      setBillId(bill.id);
                      setSelectedBill(bill);
                      if (selectedParty) setDirection(getSettlementDirectionForParty(selectedParty.type as SupportedPartyType));
                    } else {
                      setBillId("");
                      setSelectedBill(null);
                    }
                  }}
                  partyId={partyId}
                  isDisabled={!selectedParty}
                  description={t("payments.record.billSearchDesc" as TranslationKey)}
                />

                {selectedBill && (
                  <div style={{ background: PU + "12", padding: "10px 14px", borderRadius: 10, fontSize: TYPE.bodySmall, color: PU, fontFamily: SG, fontWeight: 600 }}>
                    {t("payments.record.linkedToBill" as TranslationKey)} <strong>{selectedBill.billNumber}</strong>.{" "}
                    {t("payments.record.settlementDirection" as TranslationKey)}{" "}
                    <strong>
                      {selectedParty?.type === "CUSTOMER"
                        ? t("payments.filter.received" as TranslationKey)
                        : t("payments.filter.paid" as TranslationKey)}
                    </strong>.
                  </div>
                )}
              </>
            )}

            {paymentFlowType === "ledger" && (
              <>
                <PartySearch
                  value={selectedParty?.id ?? null}
                  onChange={(party) => {
                    setSelectedParty(party);
                    setBillId("");
                    setSelectedBill(null);
                    if (party) setDirection(getSettlementDirectionForParty(party.type as SupportedPartyType));
                  }}
                  placeholder={t("payments.record.selectLedgerPlaceholder" as TranslationKey)}
                  filterTypes={["EXPENSE", "INCOME", "ASSET", "LIABILITY", "EQUITY"]}
                />

                {selectedParty && (
                  <div
                    style={{
                      padding: "10px 14px", borderRadius: 10, fontSize: TYPE.bodySmall,
                      fontFamily: SG, fontWeight: 600,
                      ...getBalanceBannerStyle(selectedParty.type as SupportedPartyType, selectedParty.currentBalance),
                    }}
                  >
                    {t("payments.record.ledgerBalance" as TranslationKey)}{" "}
                    <strong>{formatSignedBalance(selectedParty.currentBalance)}</strong>
                    <span style={{ marginLeft: 8, opacity: 0.7 }}>
                      ({selectedParty.type} ledger · Direction: {direction === "OUTGOING" ? t("payments.filter.paid" as TranslationKey) : t("payments.filter.received" as TranslationKey)})
                    </span>
                  </div>
                )}
              </>
            )}

            <HKInput
              label={t("payments.record.amountLabel" as TranslationKey)}
              placeholder={t("payments.record.amountPlaceholder" as TranslationKey)}
              type="text"
              value={amount}
              onValueChange={(value) => setAmount(sanitizeAmountInput(value))}
              size="lg"
              isRequired
              inputMode="decimal"
              pattern="[0-9]*[.]?[0-9]{0,2}"
              description={t("payments.record.amountDesc" as TranslationKey)}
              startContent={<span className="text-lg text-default-400">INR</span>}
            />

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
              {(paymentFlowType === "party" || paymentFlowType === "ledger") && (
                <HKSelect
                  label={t("payments.record.type" as TranslationKey)}
                  placeholder={t("payments.record.selectDirection" as TranslationKey)}
                  value={direction}
                  onValueChange={(v) => { if (v) setDirection(v); }}
                  isDisabled={paymentFlowType === "ledger"}
                >
                  <HKSelectItem value="INCOMING">{t("payments.filter.received" as TranslationKey)}</HKSelectItem>
                  <HKSelectItem value="OUTGOING">{t("payments.filter.paid" as TranslationKey)}</HKSelectItem>
                </HKSelect>
              )}

              <HKSelect
                label={paymentFlowType === "contra" ? t("payments.record.sourceAccount" as TranslationKey) : t("payments.record.account" as TranslationKey)}
                placeholder={t("payments.record.selectAccount" as TranslationKey)}
                value={accountId}
                onValueChange={(v) => {
                  if (!v) return;
                  setAccountId(v);
                  const acc = bankAccounts.find((a) => a.id === v);
                  setMode(acc?.type === "CASH" ? "CASH" : "BANK_TRANSFER");
                }}
              >
                {bankAccounts.map((account) => (
                  <HKSelectItem key={account.id} value={account.id}>
                    {account.name} (Bal: ₹{account.currentBalance})
                  </HKSelectItem>
                ))}
              </HKSelect>

              {paymentFlowType === "contra" && (
                <HKSelect
                  label={t("payments.record.destinationAccount" as TranslationKey)}
                  placeholder={t("payments.record.selectDestination" as TranslationKey)}
                  value={destinationAccountId}
                  onValueChange={(v) => { if (v) setDestinationAccountId(v); }}
                >
                  {bankAccounts.map((account) => (
                    <HKSelectItem key={account.id} value={account.id}>
                      {account.name} (Bal: ₹{account.currentBalance})
                    </HKSelectItem>
                  ))}
                </HKSelect>
              )}

              {paymentFlowType === "party" && (
                <HKSelect
                  label={t("payments.record.paymentMode" as TranslationKey)}
                  placeholder={t("payments.record.selectMode" as TranslationKey)}
                  value={mode}
                  onValueChange={(v) => {
                    if (!v) return;
                    setMode(v);
                    if (v === "CASH") {
                      // Auto-select cash account if one exists, otherwise
                      // clear so the user notices and creates one — don't
                      // leave a bank account silently selected against a
                      // CASH payment.
                      const cashAcc = bankAccounts.find((a) => a.type === "CASH");
                      setAccountId(cashAcc ? cashAcc.id : "");
                    } else {
                      const currentAcc = bankAccounts.find((a) => a.id === accountId);
                      if (currentAcc?.type === "CASH") {
                        const bankAcc = bankAccounts.find((a) => a.type === "BANK");
                        if (bankAcc) setAccountId(bankAcc.id);
                      }
                    }
                  }}
                >
                  <HKSelectItem value="BANK_TRANSFER">{t("payments.record.mode.bank" as TranslationKey)}</HKSelectItem>
                  <HKSelectItem value="CASH">{t("payments.record.mode.cash" as TranslationKey)}</HKSelectItem>
                  <HKSelectItem value="UPI">{t("payments.record.mode.upi" as TranslationKey)}</HKSelectItem>
                  <HKSelectItem value="CHEQUE">{t("payments.record.mode.cheque" as TranslationKey)}</HKSelectItem>
                </HKSelect>
              )}
            </div>

            <HKInput label={t("payments.record.date" as TranslationKey)} type="date" value={date} onValueChange={setDate} />
            <HKInput label={t("payments.record.notes" as TranslationKey)} placeholder={t("payments.record.notesPlaceholder" as TranslationKey)} value={notes} onValueChange={setNotes} />
          </div>
        </HKCard>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <HKButton variant="secondary" onClick={() => router.push("/payments")}>
            {t("common.cancel" as TranslationKey)}
          </HKButton>
          <HKButton onClick={handleSave} isLoading={saving}>
            {paymentStatus === "COMPLETED"
              ? t("nav.recordpayment" as TranslationKey)
              : t("payments.record.saveExpected" as TranslationKey)}
          </HKButton>
        </div>
      </div>
    </div>
  );
}
