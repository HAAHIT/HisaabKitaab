"use client";

import { useEffect, useRef, useState } from "react";
import {
  getBalanceStatusLabel,
  getSettlementDirectionForParty,
  type SupportedPartyType,
} from "@/lib/accounting";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
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

function getBalanceBannerClass(partyType: SupportedPartyType, balance: number) {
  const v = Math.round(balance * 100) / 100;
  if (v === 0) return "bg-default-100 text-default-500";
  if (v > 0) return "bg-warning/10 text-warning";
  return partyType === "CUSTOMER" ? "bg-success/10 text-success" : "bg-danger/10 text-danger";
}

function sanitizeAmountInput(value: string) {
  const normalized = value.replace(/[^\d.]/g, "");
  const parts = normalized.split(".");
  const integerPart = parts[0].slice(0, 12);

  if (parts.length === 1) {
    return integerPart;
  }

  const decimalPart = parts.slice(1).join("").slice(0, 2);
  return `${integerPart}.${decimalPart}`;
}

async function readError(response: Response) {
  const data = await response.json().catch(() => null);
  return data?.error || "Request failed";
}

export default function RecordPaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedPartyId = searchParams.get("partyId");

  // undefined = still loading the pre-selected party; null = no pre-selection or loaded
  const [initialParty, setInitialParty] = useState<PartyOption | null | undefined>(
    preselectedPartyId ? undefined : null
  );

  const [selectedParty, setSelectedParty] = useState<PartyOption | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

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

  // Fetch pre-selected party from URL param
  useEffect(() => {
    if (!preselectedPartyId) return;
    fetch(`/api/parties/${preselectedPartyId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setInitialParty(data?.party ?? null))
      .catch(() => setInitialParty(null));
  }, [preselectedPartyId]);

  // Once initialParty resolves, sync it into selectedParty and direction
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
          paymentFlowType === "ledger" ? "Select an expense/income ledger" : "Select a party",
          "error"
        );
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

    if (!amount || Number.parseFloat(amount) <= 0) {
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
          amount: Number.parseFloat(amount),
          type: paymentFlowType === "contra" ? "OUTGOING" : direction,
          mode,
          date,
          notes: notes.trim() || null,
          status: paymentStatus,
        }),
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      showToast(
        paymentStatus === "COMPLETED" ? "Payment recorded" : "Expected payment saved",
        "success"
      );
      window.setTimeout(() => router.push("/payments"), 800);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to save", "error");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  // Hold off rendering PartySearch until URL pre-selection resolves
  const partySearchReady = initialParty !== undefined;

  return (
    <div className="mx-auto max-w-2xl animate-fade-in p-4 lg:p-8">
      {toast && (
        <div
          className={`fixed right-4 top-4 z-[100] rounded-xl px-4 py-3 shadow-lg animate-slide-up ${
            toast.type === "success" ? "bg-success text-white" : "bg-danger text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="mb-6 flex items-center gap-3">
        <Button
          isIconOnly
          variant="light"
          aria-label="Back to payments"
          onPress={() => router.push("/payments")}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
            />
          </svg>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Record Payment</h1>
          <p className="mt-1 text-sm text-default-500">
            Save payments directly to the server ledger.
          </p>
        </div>
      </div>

      <section className="mb-6">
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
      </section>

      <section className="mb-6">
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
                  <path
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
              </div>
              <div className="flex-1">
                <p
                  className={`text-base font-bold ${
                    paymentStatus === "COMPLETED"
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-default-900 dark:text-default-100"
                  }`}
                >
                  Already Received / Paid
                </p>
                <p
                  className={`text-xs ${
                    paymentStatus === "COMPLETED"
                      ? "text-emerald-700/80 dark:text-emerald-300/80"
                      : "text-default-500"
                  }`}
                >
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
                  <path
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
              </div>
              <div className="flex-1">
                <p
                  className={`text-base font-bold ${
                    paymentStatus === "EXPECTED"
                      ? "text-amber-700 dark:text-amber-300"
                      : "text-default-900 dark:text-default-100"
                  }`}
                >
                  Expected / Planned
                </p>
                <p
                  className={`text-xs ${
                    paymentStatus === "EXPECTED"
                      ? "text-amber-700/80 dark:text-amber-300/80"
                      : "text-default-500"
                  }`}
                >
                  Payment confirmed for a later date
                </p>
              </div>
            </div>
          </Radio>
        </RadioGroup>
      </section>

      <Card shadow="sm" className="mb-6">
        <CardHeader className="px-6 pt-6 pb-0">
          <h2 className="font-semibold">
            {paymentFlowType === "contra" ? "Transfer Details" : "Payment Details"}
          </h2>
        </CardHeader>
        <CardBody className="space-y-5 p-6">
          {paymentFlowType === "party" && partySearchReady && (
            <>
              <PartySearch
                value={selectedParty?.id ?? null}
                initialParty={initialParty}
                onChange={(party) => {
                  setSelectedParty(party);
                  setBillId("");
                  setSelectedBill(null);
                  if (party) {
                    setDirection(getSettlementDirectionForParty(party.type as SupportedPartyType));
                  }
                }}
                placeholder="Select customer or vendor"
              />

              {selectedParty && (
                <div
                  className={`rounded-lg px-3 py-2 text-sm ${getBalanceBannerClass(
                    selectedParty.type as SupportedPartyType,
                    selectedParty.currentBalance
                  )}`}
                >
                  Current balance:{" "}
                  <strong>{formatSignedBalance(selectedParty.currentBalance)}</strong>{" "}
                  {getBalanceStatusLabel(
                    selectedParty.type as SupportedPartyType,
                    Math.round(selectedParty.currentBalance * 100) / 100
                  )}
                </div>
              )}

              <BillSearch
                value={billId}
                onChange={(bill) => {
                  if (bill) {
                    setBillId(bill.id);
                    setSelectedBill(bill);
                    if (selectedParty) {
                      setDirection(
                        getSettlementDirectionForParty(selectedParty.type as SupportedPartyType)
                      );
                    }
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
                <div className="rounded-lg bg-primary/5 px-3 py-2 text-sm text-primary">
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
                  if (party) {
                    setDirection(getSettlementDirectionForParty(party.type as SupportedPartyType));
                  }
                }}
                placeholder="Select expense, income, or other ledger"
                filterTypes={["EXPENSE", "INCOME", "ASSET", "LIABILITY", "EQUITY"]}
              />

              {selectedParty && (
                <div
                  className={`rounded-lg px-3 py-2 text-sm ${getBalanceBannerClass(
                    selectedParty.type as SupportedPartyType,
                    selectedParty.currentBalance
                  )}`}
                >
                  Ledger balance:{" "}
                  <strong>{formatSignedBalance(selectedParty.currentBalance)}</strong>
                  <span className="ml-2 text-xs text-default-400">
                    ({selectedParty.type} ledger · Direction:{" "}
                    {direction === "OUTGOING" ? "Payment" : "Receipt"})
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

          <div className="grid grid-cols-2 gap-4">
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

          <Input
            label="Date"
            type="date"
            value={date}
            onValueChange={setDate}
            variant="bordered"
          />
          <Input
            label="Notes"
            placeholder="Optional notes..."
            value={notes}
            onValueChange={setNotes}
            variant="bordered"
          />
        </CardBody>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="flat" onPress={() => router.push("/payments")}>
          Cancel
        </Button>
        <Button
          color={paymentStatus === "COMPLETED" ? "primary" : "warning"}
          className={
            paymentStatus === "COMPLETED"
              ? "bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold"
              : "font-semibold"
          }
          onPress={handleSave}
          isLoading={saving}
        >
          {paymentStatus === "COMPLETED" ? "Record Payment" : "Save Expected Payment"}
        </Button>
      </div>
    </div>
  );
}
