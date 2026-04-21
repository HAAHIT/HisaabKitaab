"use client";

import { useEffect, useState } from "react";
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
} from "@heroui/react";
import { useRouter } from "next/navigation";
import { PartySearch, type PartyOption } from "@/components/ui/PartySearch";

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

interface BillOption {
  id: string;
  billNumber: string;
  grandTotal: number;
  customerName: string;
}

function sanitizeAmountInput(value: string) {
  const normalized = value.replace(/[^\d.]/g, "");
  const parts = normalized.split(".");

  if (parts.length === 1) {
    return parts[0];
  }

  const integerPart = parts[0];
  const decimalPart = parts.slice(1).join("").slice(0, 2);
  return `${integerPart}.${decimalPart}`;
}

async function readError(response: Response) {
  const data = await response.json().catch(() => null);
  return data?.error || "Request failed";
}

export default function RecordPaymentPage() {
  const router = useRouter();
  const [selectedParty, setSelectedParty] = useState<PartyOption | null>(null);
  const [saving, setSaving] = useState(false);
  const [billsLoading, setBillsLoading] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const partyId = selectedParty?.id ?? "";
  const [billId, setBillId] = useState("");
  const [bills, setBills] = useState<BillOption[]>([]);
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState("INCOMING");
  const [mode, setMode] = useState("CASH");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("COMPLETED");

  useEffect(() => {
    if (!partyId) {
      setBills([]);
      setBillId("");
      return;
    }

    setBillsLoading(true);
    fetch(`/api/bills?status=FINAL&partyId=${partyId}&limit=100`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await readError(response));
        }

        return response.json();
      })
      .then((data) => setBills((data.bills || []) as BillOption[]))
      .catch(() => setBills([]))
      .finally(() => setBillsLoading(false));
  }, [partyId]);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }

  const selectedBill = bills.find((bill) => bill.id === billId);

  async function handleSave() {
    if (!partyId) {
      showToast("Select a party", "error");
      return;
    }

    if (!amount || Number.parseFloat(amount) <= 0) {
      showToast("Enter a valid amount", "error");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partyId,
          billId: billId || null,
          amount: Number.parseFloat(amount),
          type: direction,
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
      setSaving(false);
    }
  }

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
          <h2 className="font-semibold">Payment Details</h2>
        </CardHeader>
        <CardBody className="space-y-5 p-6">
          <PartySearch
            value={selectedParty?.id ?? null}
            onChange={(party) => {
              setSelectedParty(party);
              setBillId("");
              if (party) {
                setDirection(getSettlementDirectionForParty(party.type as SupportedPartyType));
              }
            }}
            placeholder="Select customer or vendor"
          />

          {selectedParty && (
            <div className={`rounded-lg px-3 py-2 text-sm ${getBalanceBannerClass(selectedParty.type as SupportedPartyType, selectedParty.currentBalance)}`}>
              Current balance:{" "}
              <strong>{formatSignedBalance(selectedParty.currentBalance)}</strong>
              {" "}
              {getBalanceStatusLabel(selectedParty.type as SupportedPartyType, Math.round(selectedParty.currentBalance * 100) / 100)}
            </div>
          )}

          <Select
            label="Linked Bill"
            placeholder={selectedParty ? "Optional: settle against a bill" : "Select a party first"}
            selectedKeys={billId ? new Set([billId]) : new Set([])}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0] as string;
              if (value) {
                setBillId(value);
                if (selectedParty) {
                  setDirection(getSettlementDirectionForParty(selectedParty.type as SupportedPartyType));
                }
              } else {
                setBillId("");
              }
            }}
            variant="bordered"
            isDisabled={!selectedParty}
            isLoading={billsLoading}
            description="When linked, the server validates that the payment settles the selected bill."
          >
            {bills.map((bill) => (
              <SelectItem key={bill.id} textValue={bill.billNumber}>
                <div className="flex w-full items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <span>{bill.billNumber}</span>
                    <span className="text-xs text-default-400">{bill.customerName}</span>
                  </div>
                  <span className="text-xs text-default-400">
                    INR {bill.grandTotal.toLocaleString("en-IN")}
                  </span>
                </div>
              </SelectItem>
            ))}
          </Select>

          {selectedBill && (
            <div className="rounded-lg bg-primary/5 px-3 py-2 text-sm text-primary">
              Linked to bill <strong>{selectedBill.billNumber}</strong>. Settlement direction is{" "}
              <strong>{selectedParty?.type === "CUSTOMER" ? "Received" : "Paid"}</strong>.
            </div>
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
            <Select
              label="Type"
              placeholder="Select direction"
              selectedKeys={new Set([direction])}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0] as string;
                if (value) {
                  setDirection(value);
                }
              }}
              variant="bordered"
            >
              <SelectItem key="INCOMING">Received</SelectItem>
              <SelectItem key="OUTGOING">Paid</SelectItem>
            </Select>

            <Select
              label="Payment Mode"
              placeholder="Select mode"
              selectedKeys={new Set([mode])}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0] as string;
                if (value) {
                  setMode(value);
                }
              }}
              variant="bordered"
            >
              <SelectItem key="CASH">Cash</SelectItem>
              <SelectItem key="BANK_TRANSFER">Bank Transfer</SelectItem>
              <SelectItem key="UPI">UPI</SelectItem>
              <SelectItem key="CHEQUE">Cheque</SelectItem>
            </Select>
          </div>

          <Input label="Date" type="date" value={date} onValueChange={setDate} variant="bordered" />
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
