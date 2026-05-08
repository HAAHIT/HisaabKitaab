"use client";

import { useEffect, useRef, useState } from "react";
import {
  getBalanceStatusLabel,
  getSettlementDirectionForParty,
  type SupportedPartyType,
} from "@/lib/accounting";
import {
  Input,
  Radio,
  RadioGroup,
  Select,
  SelectItem,
  Tab,
  Tabs,
} from "@heroui/react";
import { useRouter, useSearchParams } from "next/navigation";
import { PartySearch, type PartyOption } from "@/components/ui/PartySearch";
import { BillSearch, type BillOption } from "@/components/ui/BillSearch";
import {
  GR, AM, PU, OR, SG, TYPE,
  HKCard, HKToast, PageHeader, GradientButton, useIsMobile,
} from "@/components/ui/hk-design";

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
        <div style={{ marginBottom: 20 }}>
          <Tabs
            aria-label="Payment Type"
            selectedKey={paymentFlowType}
            onSelectionChange={(k) => setPaymentFlowType(k as "party" | "ledger" | "contra")}
            classNames={{ base: "w-full", tabList: "w-full" }}
          >
            <Tab key="party" title="Party Payment" />
            <Tab key="ledger" title="Expense / Income" />
            <Tab key="contra" title="Bank Transfer (Contra)" />
          </Tabs>
        </div>

        {/* Payment status */}
        <div style={{ marginBottom: 20 }}>
          <RadioGroup
            aria-label="Payment status"
            value={paymentStatus}
            onValueChange={setPaymentStatus}
            classNames={{ wrapper: "grid w-full grid-cols-1 gap-4 md:grid-cols-2" }}
          >
            <Radio
              value="COMPLETED"
              classNames={{
                base: `group relative m-0 max-w-full cursor-pointer rounded-2xl border p-4 transition-all duration-300 ${
                  paymentStatus === "COMPLETED"
                    ? "border-emerald-400/70 bg-gradient-to-br from-emerald-500/15 to-emerald-400/5 shadow-[0_10px_30px_-18px_rgba(16,185,129,0.8)] ring-1 ring-emerald-400/40"
                    : "border-default-200 bg-content1 hover:border-emerald-300/60 hover:bg-emerald-500/[0.04]"
                }`,
                label: "block w-full",
                wrapper: "hidden",
              }}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`rounded-xl p-3 transition-colors ${
                    paymentStatus === "COMPLETED"
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                  }`}
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className={`text-base font-bold ${paymentStatus === "COMPLETED" ? "text-emerald-700 dark:text-emerald-300" : "text-default-900 dark:text-default-100"}`}>
                    Already Received / Paid
                  </p>
                  <p className={`text-xs ${paymentStatus === "COMPLETED" ? "text-emerald-700/80 dark:text-emerald-300/80" : "text-default-500"}`}>
                    Money has already changed hands
                  </p>
                </div>
              </div>
            </Radio>

            <Radio
              value="EXPECTED"
              classNames={{
                base: `group relative m-0 max-w-full cursor-pointer rounded-2xl border p-4 transition-all duration-300 ${
                  paymentStatus === "EXPECTED"
                    ? "border-amber-400/70 bg-gradient-to-br from-amber-500/15 to-amber-400/5 shadow-[0_10px_30px_-18px_rgba(245,158,11,0.8)] ring-1 ring-amber-400/40"
                    : "border-default-200 bg-content1 hover:border-amber-300/60 hover:bg-amber-500/[0.04]"
                }`,
                label: "block w-full",
                wrapper: "hidden",
              }}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`rounded-xl p-3 transition-colors ${
                    paymentStatus === "EXPECTED"
                      ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                  }`}
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className={`text-base font-bold ${paymentStatus === "EXPECTED" ? "text-amber-700 dark:text-amber-300" : "text-default-900 dark:text-default-100"}`}>
                    Expected / Planned
                  </p>
                  <p className={`text-xs ${paymentStatus === "EXPECTED" ? "text-amber-700/80 dark:text-amber-300/80" : "text-default-500"}`}>
                    Payment confirmed for a later date
                  </p>
                </div>
              </div>
            </Radio>
          </RadioGroup>
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

            <Input
              label="Amount (INR)"
              placeholder="Enter amount"
              type="text"
              value={amount}
              onValueChange={(value) => setAmount(sanitizeAmountInput(value))}
              variant="bordered"
              size="lg"
              isRequired
              inputMode="decimal"
              pattern="[0-9]*[.]?[0-9]{0,2}"
              description="Plain text amount entry avoids accidental mouse-wheel step changes."
              startContent={<span className="text-lg text-default-400">INR</span>}
            />

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
              {(paymentFlowType === "party" || paymentFlowType === "ledger") && (
                <Select
                  label="Type"
                  placeholder="Select direction"
                  selectedKeys={new Set([direction])}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as string;
                    if (value) setDirection(value);
                  }}
                  variant="bordered"
                  isDisabled={paymentFlowType === "ledger"}
                >
                  <SelectItem key="INCOMING">Received</SelectItem>
                  <SelectItem key="OUTGOING">Paid</SelectItem>
                </Select>
              )}

              <Select
                label={paymentFlowType === "contra" ? "Source Account" : "Account"}
                placeholder="Select account"
                selectedKeys={new Set(accountId ? [accountId] : [])}
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0] as string;
                  if (value) {
                    setAccountId(value);
                    const acc = bankAccounts.find((a) => a.id === value);
                    setMode(acc?.type === "CASH" ? "CASH" : "BANK_TRANSFER");
                  }
                }}
                variant="bordered"
              >
                {bankAccounts.map((account) => (
                  <SelectItem key={account.id} textValue={account.name}>
                    {account.name} (Bal: ₹{account.currentBalance})
                  </SelectItem>
                ))}
              </Select>

              {paymentFlowType === "contra" && (
                <Select
                  label="Destination Account"
                  placeholder="Select destination"
                  selectedKeys={new Set(destinationAccountId ? [destinationAccountId] : [])}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as string;
                    if (value) setDestinationAccountId(value);
                  }}
                  variant="bordered"
                >
                  {bankAccounts.map((account) => (
                    <SelectItem key={account.id} textValue={account.name}>
                      {account.name} (Bal: ₹{account.currentBalance})
                    </SelectItem>
                  ))}
                </Select>
              )}

              {paymentFlowType === "party" && (
                <Select
                  label="Payment Mode"
                  placeholder="Select mode"
                  selectedKeys={new Set([mode])}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as string;
                    if (!value) return;
                    setMode(value);
                    if (value === "CASH") {
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
                  variant="bordered"
                >
                  <SelectItem key="BANK_TRANSFER">Bank Transfer</SelectItem>
                  <SelectItem key="CASH">Cash</SelectItem>
                  <SelectItem key="UPI">UPI</SelectItem>
                  <SelectItem key="CHEQUE">Cheque</SelectItem>
                </Select>
              )}
            </div>

            <Input label="Date" type="date" value={date} onValueChange={setDate} variant="bordered" />
            <Input label="Notes" placeholder="Optional notes..." value={notes} onValueChange={setNotes} variant="bordered" />
          </div>
        </HKCard>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button
            onClick={() => router.push("/payments")}
            style={{
              minHeight: 48, padding: "0 22px", borderRadius: 14,
              background: "var(--hk-badge)", border: "1px solid var(--hk-border)",
              color: "var(--hk-text)", fontFamily: SG, fontSize: TYPE.body, fontWeight: 600, cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <GradientButton onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : paymentStatus === "COMPLETED" ? "Record Payment" : "Save Expected Payment"}
          </GradientButton>
        </div>
      </div>
    </div>
  );
}
