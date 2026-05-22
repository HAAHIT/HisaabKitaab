"use client";

import { useEffect, useState } from "react";
import { HKSelect, HKSelectItem } from "@/components/ui/HKSelect";
import { PartySearch, type PartyOption } from "@/components/ui/PartySearch";
import { getSettlementDirectionForParty, type SupportedPartyType } from "@/lib/accounting";
import {
  OR, GR, AM, SG, IN, TYPE,
  HKSheet,
} from "@/components/ui/hk-design";
import { HKButton } from "@/components/ui/HKButton";
import { HKInput } from "@/components/ui/HKInput";
import { useLanguage } from "@/contexts/LanguageContext";

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

const TABS = [
  { key: "party", labelKey: "payments.edit.tab.party" as const },
  { key: "ledger", labelKey: "payments.edit.tab.ledger" as const },
  { key: "contra", labelKey: "payments.edit.tab.contra" as const },
] as const;

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
  const { t } = useLanguage();
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
          setError(t("payments.edit.error.loadAccounts").replace("{status}", String(r.status)));
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (d && Array.isArray(d.accounts)) setBankAccounts(d.accounts);
      })
      .catch(() => {
        setError(t("payments.edit.error.network"));
      });
  }, [isOpen, bankAccounts.length, t]);

  async function handleSave() {
    if (!payment) return;
    setError(null);

    if ((paymentType === "party" || paymentType === "ledger") && !selectedParty && !payment.partyId) {
      setError(paymentType === "ledger" ? t("payments.edit.error.selectLedger") : t("payments.edit.error.selectParty"));
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setError(t("payments.edit.error.invalidAmount"));
      return;
    }
    if (!accountId) {
      setError(t("payments.edit.error.selectAccount"));
      return;
    }
    if (paymentType === "contra" && !destAccountId) {
      setError(t("payments.edit.error.selectDestination"));
      return;
    }
    if (paymentType === "contra" && accountId === destAccountId) {
      setError(t("payments.edit.error.sameAccounts"));
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
      setError(e instanceof Error ? e.message : t("payments.edit.error.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  const fmtBalance = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  return (
    <HKSheet
      isOpen={isOpen}
      onClose={onClose}
      title={t("payments.edit.title")}
      footer={
        <>
          <HKButton variant="secondary" onClick={onClose} isDisabled={isSaving}>{t("common.cancel")}</HKButton>
          <HKButton onClick={handleSave} isLoading={isSaving}>{t("payments.edit.save")}</HKButton>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

        {/* Payment type tabs */}
        <div style={{ display: "flex", gap: 6, background: "var(--sb-badge)", padding: 4, borderRadius: 12 }}>
          {TABS.map((tab) => {
            const active = paymentType === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setPaymentType(tab.key)}
                style={{
                  flex: 1, padding: "8px 10px", borderRadius: 9, border: "none",
                  background: active ? "var(--sb-card)" : "transparent",
                  boxShadow: active ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
                  color: active ? "var(--sb-text)" : "var(--sb-sub)",
                  fontFamily: SG, fontSize: TYPE.bodySmall, fontWeight: active ? 700 : 500,
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                {t(tab.labelKey)}
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
                ? t("payments.edit.error.selectLedger")
                : t("payments.edit.error.selectParty")
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
          label={t("payments.record.amountLabel")}
          type="text"
          value={amount}
          onValueChange={(v) => setAmount(sanitizeAmount(v))}
          inputMode="decimal"
          startContent={<span style={{ color: "var(--sb-sub)", fontFamily: IN }}>₹</span>}
          classNames={{ label: "font-semibold" }}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* Direction */}
          {(paymentType === "party" || paymentType === "ledger") && (
            <HKSelect
              label={t("payments.record.type")}
              value={direction}
              onValueChange={(v) => { if (v) setDirection(v); }}
              isDisabled={paymentType === "ledger"}
            >
              <HKSelectItem value="INCOMING">{t("payments.edit.direction.incoming")}</HKSelectItem>
              <HKSelectItem value="OUTGOING">{t("payments.edit.direction.outgoing")}</HKSelectItem>
            </HKSelect>
          )}

          {/* Source account */}
          <HKSelect
            label={paymentType === "contra" ? t("payments.record.sourceAccount") : t("payments.record.account")}
            value={accountId}
            placeholder={bankAccounts.length === 0 ? t("payments.edit.noAccounts") : t("payments.edit.selectAccount")}
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
              label={t("payments.record.destinationAccount")}
              value={destAccountId}
              placeholder={bankAccounts.length === 0 ? t("payments.edit.noAccounts") : t("payments.edit.selectDestination")}
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
              label={t("payments.record.paymentMode")}
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
              <HKSelectItem value="BANK_TRANSFER">{t("payments.record.mode.bank")}</HKSelectItem>
              <HKSelectItem value="CASH">{t("payments.record.mode.cash")}</HKSelectItem>
              <HKSelectItem value="UPI">{t("payments.record.mode.upi")}</HKSelectItem>
              <HKSelectItem value="CHEQUE">{t("payments.record.mode.cheque")}</HKSelectItem>
            </HKSelect>
          )}
        </div>

        <HKInput
          label={t("payments.record.date")}
          type="date"
          value={date}
          onValueChange={setDate}
        />

        <HKInput
          label={t("payments.record.notes")}
          placeholder={t("payments.edit.notesPlaceholder")}
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
    </HKSheet>
  );
}
