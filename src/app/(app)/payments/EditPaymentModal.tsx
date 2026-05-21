"use client";

import { useEffect, useState } from "react";
import { HKSelect, HKSelectItem } from "@/components/ui/HKSelect";
import { PartySearch, type PartyOption } from "@/components/ui/PartySearch";
import { getSettlementDirectionForParty, type SupportedPartyType } from "@/lib/accounting";
import {
  OR, GR, AM, SG, IN, TYPE,
  HKModal,
} from "@/components/ui/hk-design";
import { HKButton } from "@/components/ui/HKButton";
import { HKInput } from "@/components/ui/HKInput";

type BankAccount = {
  id: string;
  name: string;
  type: string;
  currentBalance: number;
};

export type EditablePayment = {
  id: string;
  partyId: string | null;
  accountId: string | null;
  destinationAccountId: string | null;
  amount: number;
  direction: string;
  mode: string;
  date: string;
  notes: string | null;
  party: { name: string; type: string } | null;
};

function sanitizeAmount(value: string) {
  const normalized = value.replace(/[^\d.]/g, "");
  const parts = normalized.split(".");
  const integerPart = parts[0].slice(0, 12);
  if (parts.length === 1) return integerPart;
  return `${integerPart}.${parts.slice(1).join("").slice(0, 2)}`;
}

async function readError(res: Response) {
  const data = await res.json().catch(() => null);
  return data?.error || "Request failed";
}

type PaymentType = "party" | "ledger" | "contra";

const TABS: { key: PaymentType; label: string }[] = [
  { key: "party", label: "Party" },
  { key: "ledger", label: "Expense / Income" },
  { key: "contra", label: "Bank Transfer" },
];

export function EditPaymentModal({
  payment,
  isOpen,
  onClose,
  onSuccess,
}: {
  payment: EditablePayment | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isContraPayment = !payment?.partyId && !!payment?.destinationAccountId;
  const isLedgerPayment = payment?.party
    ? ["EXPENSE", "INCOME", "ASSET", "LIABILITY", "EQUITY"].includes(payment.party.type)
    : false;

  const [paymentType, setPaymentType] = useState<PaymentType>("party");
  const [selectedParty, setSelectedParty] = useState<PartyOption | null>(null);
  const [accountId, setAccountId] = useState("");
  const [destAccountId, setDestAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState("INCOMING");
  const [mode, setMode] = useState("BANK_TRANSFER");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!payment) return;
    setPaymentType(isContraPayment ? "contra" : isLedgerPayment ? "ledger" : "party");
    setSelectedParty(null);
    setAccountId(payment.accountId ?? "");
    setDestAccountId(payment.destinationAccountId ?? "");
    setAmount(String(payment.amount));
    setDirection(payment.direction);
    setMode(payment.mode);
    setDate(new Date(payment.date).toISOString().split("T")[0]);
    setNotes(payment.notes ?? "");
    setError(null);
  }, [payment, isContraPayment, isLedgerPayment]);

  useEffect(() => {
    if (!isOpen || bankAccounts.length > 0) return;
    fetch("/api/bank-accounts")
      .then(async (r) => {
        if (!r.ok) {
          setError(`Bank accounts load nahi hua (${r.status})`);
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (d && Array.isArray(d.accounts)) setBankAccounts(d.accounts);
      })
      .catch(() => {
        setError("Bank accounts load nahi hua. Network check karo.");
      });
  }, [isOpen, bankAccounts.length]);

  async function handleSave() {
    if (!payment) return;
    setError(null);

    if ((paymentType === "party" || paymentType === "ledger") && !selectedParty && !payment.partyId) {
      setError(paymentType === "ledger" ? "Ledger select karo" : "Party select karo");
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setError("Valid amount daalo");
      return;
    }
    if (!accountId) {
      setError("Account select karo");
      return;
    }
    if (paymentType === "contra" && !destAccountId) {
      setError("Destination account select karo");
      return;
    }
    if (paymentType === "contra" && accountId === destAccountId) {
      setError("Source aur destination same nahi ho sakta");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/payments/${payment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partyId: (paymentType === "party" || paymentType === "ledger")
            ? (selectedParty?.id ?? payment.partyId) : null,
          destinationAccountId: paymentType === "contra" ? destAccountId : null,
          accountId,
          amount: parseFloat(amount),
          direction: paymentType === "contra" ? "OUTGOING" : direction,
          mode,
          date,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save nahi hua");
    } finally {
      setIsSaving(false);
    }
  }

  const fmtBalance = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  return (
    <HKModal
      isOpen={isOpen}
      onClose={onClose}
      title="Payment Edit Karo"
      footer={
        <>
          <HKButton variant="secondary" onClick={onClose} isDisabled={isSaving}>Cancel</HKButton>
          <HKButton onClick={handleSave} isLoading={isSaving}>Save Karo</HKButton>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

        {/* Payment type tabs */}
        <div style={{ display: "flex", gap: 6, background: "var(--hk-badge)", padding: 4, borderRadius: 12 }}>
          {TABS.map((tab) => {
            const active = paymentType === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setPaymentType(tab.key)}
                style={{
                  flex: 1, padding: "8px 10px", borderRadius: 9, border: "none",
                  background: active ? "var(--hk-card)" : "transparent",
                  boxShadow: active ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
                  color: active ? "var(--hk-text)" : "var(--hk-sub)",
                  fontFamily: SG, fontSize: TYPE.bodySmall, fontWeight: active ? 700 : 500,
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Party / Ledger search */}
        {(paymentType === "party" || paymentType === "ledger") && (
          <PartySearch
            value={selectedParty?.id ?? payment?.partyId ?? null}
            initialParty={
              payment?.partyId && payment.party
                ? {
                    id: payment.partyId,
                    name: payment.party.name,
                    type: payment.party.type,
                    phone: null,
                    currentBalance: 0,
                    address: null,
                    gstin: null,
                  }
                : null
            }
            onChange={(party) => {
              setSelectedParty(party);
              if (party) setDirection(getSettlementDirectionForParty(party.type as SupportedPartyType));
            }}
            placeholder={
              paymentType === "ledger"
                ? "Expense, income ya ledger chunno"
                : "Customer ya vendor chunno"
            }
            filterTypes={
              paymentType === "ledger"
                ? ["EXPENSE", "INCOME", "ASSET", "LIABILITY", "EQUITY"]
                : undefined
            }
          />
        )}

        {/* Amount */}
        <HKInput
          label="Amount (₹)"
          type="text"
          value={amount}
          onValueChange={(v) => setAmount(sanitizeAmount(v))}
          inputMode="decimal"
          startContent={<span style={{ color: "var(--hk-sub)", fontFamily: IN }}>₹</span>}
          classNames={{ label: "font-semibold" }}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* Direction */}
          {(paymentType === "party" || paymentType === "ledger") && (
            <HKSelect
              label="Type"
              value={direction}
              onValueChange={(v) => { if (v) setDirection(v); }}
              isDisabled={paymentType === "ledger"}
            >
              <HKSelectItem value="INCOMING">Mila (Received)</HKSelectItem>
              <HKSelectItem value="OUTGOING">Diya (Paid)</HKSelectItem>
            </HKSelect>
          )}

          {/* Source account */}
          <HKSelect
            label={paymentType === "contra" ? "Source Account" : "Account"}
            value={accountId}
            placeholder={bankAccounts.length === 0 ? "Koi bank account nahi" : "Account chuno"}
            onValueChange={(v) => {
              if (!v) return;
              setAccountId(v);
              const acc = bankAccounts.find((a) => a.id === v);
              if (acc) setMode(acc.type === "CASH" ? "CASH" : "BANK_TRANSFER");
            }}
          >
            {bankAccounts.map((acc) => (
              <HKSelectItem key={acc.id} value={acc.id}>
                {acc.name} · {fmtBalance(acc.currentBalance)}
              </HKSelectItem>
            ))}
          </HKSelect>

          {/* Destination (contra only) */}
          {paymentType === "contra" && (
            <HKSelect
              label="Destination Account"
              value={destAccountId}
              placeholder={bankAccounts.length === 0 ? "Koi bank account nahi" : "Destination chuno"}
              onValueChange={(v) => { if (v) setDestAccountId(v); }}
            >
              {bankAccounts.map((acc) => (
                <HKSelectItem key={acc.id} value={acc.id}>
                  {acc.name} · {fmtBalance(acc.currentBalance)}
                </HKSelectItem>
              ))}
            </HKSelect>
          )}

          {/* Mode */}
          {(paymentType === "party" || paymentType === "ledger") && (
            <HKSelect
              label="Payment Mode"
              value={mode}
              onValueChange={(v) => {
                if (!v) return;
                setMode(v);
                if (v === "CASH") {
                  // Auto-pick the cash account if one exists; otherwise
                  // clear so the user doesn't accidentally leave a bank
                  // account selected for a CASH payment.
                  const cashAcc = bankAccounts.find((a) => a.type === "CASH");
                  setAccountId(cashAcc ? cashAcc.id : "");
                } else {
                  const cur = bankAccounts.find((a) => a.id === accountId);
                  if (cur?.type === "CASH") {
                    const bank = bankAccounts.find((a) => a.type === "BANK");
                    if (bank) setAccountId(bank.id);
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

        <HKInput
          label="Date"
          type="date"
          value={date}
          onValueChange={setDate}
        />

        <HKInput
          label="Notes"
          placeholder="Optional..."
          value={notes}
          onValueChange={setNotes}
        />

        {/* Error */}
        {error && (
          <div style={{
            padding: "10px 14px", borderRadius: 10,
            background: OR + "15", border: `1px solid ${OR}33`,
            fontSize: TYPE.bodySmall, fontWeight: 600, color: OR, fontFamily: SG,
          }}>
            {error}
          </div>
        )}
      </div>
    </HKModal>
  );
}
