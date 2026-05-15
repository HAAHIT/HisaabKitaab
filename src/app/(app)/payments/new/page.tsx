"use client";

import { useEffect, useRef, useState } from "react";
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
  GR, AM, PU, OR, SG, TYPE,
  HKCard, HKToast, PageHeader, useIsMobile,
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

function getBalanceBannerStyle(partyType: SupportedPartyType, balance: number) {
  const v = Math.round(balance * 100) / 100;
  if (v === 0) return { background: "var(--hk-badge)", color: "var(--hk-sub)" };
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
        showToast(paymentFlowType === "ledger" ? "Select an expense/income ledger" : "Select a party", "error");
        return;
      }
    } else {
      if (!accountId || !destinationAccountId) {
        showToast("Select both Source and Destination accounts", "error");
        return;
      }
      if (accountId === destinationAccountId) {
        showToast("Source and Destination accounts cannot be the same", "error");
        return;
      }
    }

    if (!amount || parseFloat(amount) <= 0) {
      showToast("Enter a valid amount", "error");
      return;
    }
    if (!accountId) {
      showToast("Select a Bank or Cash account", "error");
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

      showToast(paymentStatus === "COMPLETED" ? "Payment recorded" : "Expected payment saved", "success");
      window.setTimeout(() => router.push("/payments"), 800);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to save", "error");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const partySearchReady = initialParty !== undefined;

  return (
    <div style={{ background: "var(--hk-bg)", minHeight: "100%", fontFamily: SG }}>
      {toast && <HKToast message={toast.message} type={toast.type} />}

      <PageHeader
        title="Record Payment"
        subtitle="Payment ledger mein save karo"
        isMobile={isMobile}
        action={
          <button
            onClick={() => router.push("/payments")}
            style={{
              display: "flex", alignItems: "center", gap: 6, background: "none", border: "none",
              color: "var(--hk-sub)", fontSize: TYPE.body, fontFamily: SG, fontWeight: 600, cursor: "pointer",
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round">
              <path d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Wapas
          </button>
        }
      />

      <div style={{ padding: isMobile ? "0 14px 100px" : "0 28px 80px", maxWidth: 680, margin: "0 auto" }}>
        {/* Payment type tabs */}
        <div style={{ marginBottom: 20, display: "flex", gap: 4, background: "var(--hk-badge)", borderRadius: 14, padding: 4 }}>
          {(["party", "ledger", "contra"] as const).map((key) => {
            const labels = { party: "Party Payment", ledger: "Expense / Income", contra: "Bank Transfer (Contra)" };
            return (
              <button
                key={key}
                type="button"
                onClick={() => setPaymentFlowType(key)}
                style={{
                  flex: 1, padding: "8px 12px", borderRadius: 10, cursor: "pointer",
                  background: paymentFlowType === key ? "var(--hk-card)" : "transparent",
                  border: paymentFlowType === key ? "1px solid var(--hk-border)" : "1px solid transparent",
                  color: paymentFlowType === key ? "var(--hk-text)" : "var(--hk-sub)",
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
              label: "Already Received / Paid",
              sub: "Money has already changed hands",
              icon: <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />,
            },
            {
              value: "EXPECTED",
              color: AM,
              label: "Expected / Planned",
              sub: "Payment confirmed for a later date",
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
                  border: `1.5px solid ${active ? color + "70" : "var(--hk-border)"}`,
                  background: active ? color + "12" : "var(--hk-card)",
                  boxShadow: active ? `0 8px 24px -12px ${color}80` : "none",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ borderRadius: 12, padding: 12, background: active ? color : color + "18", color: active ? "#fff" : color, flexShrink: 0 }}>
                  <svg width={24} height={24} fill="none" stroke="currentColor" viewBox="0 0 24 24">{icon}</svg>
                </div>
                <div>
                  <p style={{ fontSize: TYPE.body, fontWeight: 700, color: active ? color : "var(--hk-text)", fontFamily: SG }}>{label}</p>
                  <p style={{ fontSize: TYPE.caption, color: active ? color + "cc" : "var(--hk-sub)", fontFamily: SG, marginTop: 2 }}>{sub}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Payment details */}
        <HKCard style={{ marginBottom: 20 }}>
          <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--hk-text)", fontFamily: SG, marginBottom: 20 }}>
            {paymentFlowType === "contra" ? "Transfer Details" : "Payment Details"}
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
                  placeholder="Select customer or vendor"
                />

                {selectedParty && (
                  <div
                    style={{
                      padding: "10px 14px", borderRadius: 10, fontSize: TYPE.bodySmall,
                      fontFamily: SG, fontWeight: 600,
                      ...getBalanceBannerStyle(selectedParty.type as SupportedPartyType, selectedParty.currentBalance),
                    }}
                  >
                    Current balance: <strong>{formatSignedBalance(selectedParty.currentBalance)}</strong>{" "}
                    {getBalanceStatusLabel(selectedParty.type as SupportedPartyType, Math.round(selectedParty.currentBalance * 100) / 100)}
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
                  description="When linked, the server validates that the payment settles the selected bill."
                />

                {selectedBill && (
                  <div style={{ background: PU + "12", padding: "10px 14px", borderRadius: 10, fontSize: TYPE.bodySmall, color: PU, fontFamily: SG, fontWeight: 600 }}>
                    Linked to bill <strong>{selectedBill.billNumber}</strong>. Settlement direction is{" "}
                    <strong>{selectedParty?.type === "CUSTOMER" ? "Received" : "Paid"}</strong>.
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
                  placeholder="Select expense, income, or other ledger"
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
                    Ledger balance: <strong>{formatSignedBalance(selectedParty.currentBalance)}</strong>
                    <span style={{ marginLeft: 8, opacity: 0.7 }}>
                      ({selectedParty.type} ledger · Direction: {direction === "OUTGOING" ? "Payment" : "Receipt"})
                    </span>
                  </div>
                )}
              </>
            )}

            <HKInput
              label="Amount (INR)"
              placeholder="Enter amount"
              type="text"
              value={amount}
              onValueChange={(value) => setAmount(sanitizeAmountInput(value))}
              size="lg"
              isRequired
              inputMode="decimal"
              pattern="[0-9]*[.]?[0-9]{0,2}"
              description="Plain text amount entry avoids accidental mouse-wheel step changes."
              startContent={<span className="text-lg text-default-400">INR</span>}
            />

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
              {(paymentFlowType === "party" || paymentFlowType === "ledger") && (
                <HKSelect
                  label="Type"
                  placeholder="Select direction"
                  value={direction}
                  onValueChange={(v) => { if (v) setDirection(v); }}
                  isDisabled={paymentFlowType === "ledger"}
                >
                  <HKSelectItem value="INCOMING">Received</HKSelectItem>
                  <HKSelectItem value="OUTGOING">Paid</HKSelectItem>
                </HKSelect>
              )}

              <HKSelect
                label={paymentFlowType === "contra" ? "Source Account" : "Account"}
                placeholder="Select account"
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
                  label="Destination Account"
                  placeholder="Select destination"
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
                  label="Payment Mode"
                  placeholder="Select mode"
                  value={mode}
                  onValueChange={(v) => {
                    if (!v) return;
                    setMode(v);
                    if (v === "CASH") {
                      const cashAcc = bankAccounts.find((a) => a.type === "CASH");
                      if (cashAcc) setAccountId(cashAcc.id);
                    } else {
                      const currentAcc = bankAccounts.find((a) => a.id === accountId);
                      if (currentAcc?.type === "CASH") {
                        const bankAcc = bankAccounts.find((a) => a.type === "BANK");
                        if (bankAcc) setAccountId(bankAcc.id);
                      }
                    }
                  }}
                >
                  <HKSelectItem value="BANK_TRANSFER">Bank Transfer</HKSelectItem>
                  <HKSelectItem value="CASH">Cash</HKSelectItem>
                  <HKSelectItem value="UPI">UPI</HKSelectItem>
                  <HKSelectItem value="CHEQUE">Cheque</HKSelectItem>
                </HKSelect>
              )}
            </div>

            <HKInput label="Date" type="date" value={date} onValueChange={setDate} />
            <HKInput label="Notes" placeholder="Optional notes..." value={notes} onValueChange={setNotes} />
          </div>
        </HKCard>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <HKButton variant="secondary" onClick={() => router.push("/payments")}>
            Cancel
          </HKButton>
          <HKButton onClick={handleSave} isLoading={saving}>
            {paymentStatus === "COMPLETED" ? "Record Payment" : "Save Expected Payment"}
          </HKButton>
        </div>
      </div>
    </div>
  );
}
