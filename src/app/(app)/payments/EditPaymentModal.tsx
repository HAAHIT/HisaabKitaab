"use client";

import { useEffect, useState } from "react";
import { Input, Select, SelectItem } from "@heroui/react";
import { PartySearch, type PartyOption } from "@/components/ui/PartySearch";
import { getSettlementDirectionForParty, type SupportedPartyType } from "@/lib/accounting";
import {
  OR, GR, AM, SG, IN, TYPE,
  HKModal, GradientButton,
} from "@/components/ui/hk-design";

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
      .then((r) => r.json())
      .then((d) => setBankAccounts(d.accounts || []))
      .catch(() => {});
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
          <button
            onClick={onClose}
            disabled={isSaving}
            style={{
              padding: "10px 20px", borderRadius: 12, border: "1px solid var(--hk-border)",
              background: "var(--hk-badge)", color: "var(--hk-text)", fontFamily: SG,
              fontSize: TYPE.body, fontWeight: 600, cursor: isSaving ? "not-allowed" : "pointer",
              opacity: isSaving ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
          <GradientButton onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Karo"}
          </GradientButton>
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
        <Input
          label="Amount (₹)"
          type="text"
          value={amount}
          onValueChange={(v) => setAmount(sanitizeAmount(v))}
          variant="bordered"
          inputMode="decimal"
          startContent={<span style={{ color: "var(--hk-sub)", fontFamily: IN }}>₹</span>}
          classNames={{ label: "font-semibold" }}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* Direction */}
          {(paymentType === "party" || paymentType === "ledger") && (
            <Select
              label="Type"
              selectedKeys={new Set([direction])}
              onSelectionChange={(keys) => { const v = Array.from(keys)[0] as string; if (v) setDirection(v); }}
              variant="bordered"
              isDisabled={paymentType === "ledger"}
            >
              <SelectItem key="INCOMING">Mila (Received)</SelectItem>
              <SelectItem key="OUTGOING">Diya (Paid)</SelectItem>
            </Select>
          )}

          {/* Source account */}
          <Select
            label={paymentType === "contra" ? "Source Account" : "Account"}
            selectedKeys={new Set(accountId ? [accountId] : [])}
            onSelectionChange={(keys) => {
              const v = Array.from(keys)[0] as string;
              if (!v) return;
              setAccountId(v);
              const acc = bankAccounts.find((a) => a.id === v);
              if (acc) setMode(acc.type === "CASH" ? "CASH" : "BANK_TRANSFER");
            }}
            variant="bordered"
          >
            {bankAccounts.map((acc) => (
              <SelectItem key={acc.id} textValue={acc.name}>
                {acc.name} · {fmtBalance(acc.currentBalance)}
              </SelectItem>
            ))}
          </Select>

          {/* Destination (contra only) */}
          {paymentType === "contra" && (
            <Select
              label="Destination Account"
              selectedKeys={new Set(destAccountId ? [destAccountId] : [])}
              onSelectionChange={(keys) => { const v = Array.from(keys)[0] as string; if (v) setDestAccountId(v); }}
              variant="bordered"
            >
              {bankAccounts.map((acc) => (
                <SelectItem key={acc.id} textValue={acc.name}>
                  {acc.name} · {fmtBalance(acc.currentBalance)}
                </SelectItem>
              ))}
            </Select>
          )}

          {/* Mode */}
          {(paymentType === "party" || paymentType === "ledger") && (
            <Select
              label="Payment Mode"
              selectedKeys={new Set([mode])}
              onSelectionChange={(keys) => {
                const v = Array.from(keys)[0] as string;
                if (!v) return;
                setMode(v);
                if (v === "CASH") {
                  const cashAcc = bankAccounts.find((a) => a.type === "CASH");
                  if (cashAcc) setAccountId(cashAcc.id);
                } else {
                  const cur = bankAccounts.find((a) => a.id === accountId);
                  if (cur?.type === "CASH") {
                    const bank = bankAccounts.find((a) => a.type === "BANK");
                    if (bank) setAccountId(bank.id);
                  }
                }
              }}
              variant="bordered"
            >
              <SelectItem key="BANK_TRANSFER">Bank Transfer</SelectItem>
              <SelectItem key="CASH">Cash</SelectItem>
              <SelectItem key="UPI">UPI</SelectItem>
              <SelectItem key="CHEQUE">Cheque</SelectItem>
            </Select>
          )}
        </div>

        <Input
          label="Date"
          type="date"
          value={date}
          onValueChange={setDate}
          variant="bordered"
        />

        <Input
          label="Notes"
          placeholder="Optional..."
          value={notes}
          onValueChange={setNotes}
          variant="bordered"
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
