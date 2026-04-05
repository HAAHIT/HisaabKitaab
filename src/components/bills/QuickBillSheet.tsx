"use client";

import { useEffect, useState } from "react";
import { Button, ButtonGroup, Input } from "@heroui/react";
import BottomSheet from "@/components/ui/BottomSheet";
import { PartySearch, type PartyOption } from "@/components/ui/PartySearch";
import { useLanguage } from "@/contexts/LanguageContext";

const QUICK_BILL_PAYMENT_MODES = [
  { label: "Cash", value: "CASH" },
  { label: "UPI", value: "UPI" },
  { label: "Bank", value: "BANK_TRANSFER" },
  { label: "Cheque", value: "CHEQUE" },
] as const;

type QuickBillPaymentMode = (typeof QUICK_BILL_PAYMENT_MODES)[number]["value"];

interface QuickBillSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onBillCreated?: (bill: { id: string; billNumber: string }) => void;
}

function sanitizeAmountInput(value: string) {
  const normalized = value.replace(/[^\d.]/g, "");
  const parts = normalized.split(".");

  if (parts.length === 1) {
    return parts[0];
  }

  // Only allow one decimal point, max 2 decimal places
  return `${parts[0]}.${parts.slice(1).join("").replace(/\./g, "").slice(0, 2)}`;
}

async function readError(response: Response) {
  const data = await response.json().catch(() => null);
  return data?.error || "Failed to create quick bill";
}

export function QuickBillSheet({
  isOpen,
  onClose,
  onBillCreated,
}: QuickBillSheetProps) {
  const { t } = useLanguage();
  const [selectedParty, setSelectedParty] = useState<PartyOption | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [paymentMode, setPaymentMode] = useState<QuickBillPaymentMode>("CASH");
  const [recordPayment, setRecordPayment] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-fill description from last bill when party is selected
  useEffect(() => {
    if (!selectedParty || description) {
      return;
    }

    let isMounted = true;

    fetch(`/api/bills?partyId=${selectedParty.id}&limit=1`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted || !data.bills?.[0]) {
          return;
        }

        const lastDesc = data.bills[0].rows?.[0]?.desc || data.bills[0].rows?.[0]?.description;
        if (lastDesc) {
          setDescription(lastDesc);
        }
      })
      .catch(() => {
        // silently fail — this is a non-critical convenience feature
      });

    return () => {
      isMounted = false;
    };
  }, [selectedParty]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isOpen) {
      setError(null);
    }
  }, [isOpen]);

  function handlePartyChange(party: PartyOption | null) {
    setSelectedParty(party);
    setError(null);
  }

  function handleAmountChange(value: string) {
    setAmount(sanitizeAmountInput(value));
    setError(null);
  }

  async function handleSubmit() {
    if (!selectedParty) {
      setError("Please select a party.");
      return;
    }

    const parsedAmount = Number.parseFloat(amount);
    if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: "__QUICK_BILL__",
          partyId: selectedParty.id,
          customerName: selectedParty.name,
          customerPhone: selectedParty.phone || null,
          customerAddress: selectedParty.address || null,
          gstin: selectedParty.gstin || null,
          rows: [{ desc: description || "Quick Bill", amt: parsedAmount }],
          subtotal: parsedAmount,
          taxPercent: 0,
          taxAmount: 0,
          grandTotal: parsedAmount,
          status: "FINAL",
          ...(recordPayment ? { paymentMode } : {}),
        }),
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const data = await response.json();

      onBillCreated?.({ id: data.bill.id, billNumber: data.bill.billNumber });
      onClose();

      // Delay state reset to avoid flickering during close animation
      setTimeout(() => {
        setSelectedParty(null);
        setAmount("");
        setDescription("");
        setPaymentMode("CASH");
        setRecordPayment(true);
      }, 300);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "An error occurred while creating the bill."
      );
    } finally {
      setLoading(false);
    }
  }

  const parsedAmount = Number.parseFloat(amount);
  const amountDisplay =
    amount && Number.isFinite(parsedAmount)
      ? `₹${parsedAmount.toLocaleString("en-IN")}`
      : "";

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={t("bills.quickBill")}>
      <div className="flex flex-col gap-3">
        <PartySearch
          value={selectedParty?.id || null}
          onChange={handlePartyChange}
          partyType="CUSTOMER"
          placeholder={t("bills.quickSearchParty")}
          autoFocus
        />

        {/* Amount + Description side by side */}
        <div className="flex gap-2">
          <Input
            type="text"
            inputMode="decimal"
            label="Amount"
            placeholder="0.00"
            value={amount}
            onValueChange={handleAmountChange}
            variant="bordered"
            isRequired
            pattern="[0-9]*[.]?[0-9]{0,2}"
            startContent={<span className="text-default-400">₹</span>}
            isInvalid={Boolean(error) && !amount}
            className="w-36 shrink-0"
          />
          <Input
            label={t("bills.quickDescription")}
            placeholder="e.g. Hardware supplies"
            value={description}
            onValueChange={setDescription}
            variant="bordered"
            className="flex-1"
          />
        </div>

        {/* Payment mode row */}
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs font-medium text-default-500">Pay via</span>

          {recordPayment ? (
            <ButtonGroup size="sm" className="flex-1">
              {QUICK_BILL_PAYMENT_MODES.map((mode) => (
                <Button
                  key={mode.value}
                  onPress={() => setPaymentMode(mode.value)}
                  color={paymentMode === mode.value ? "primary" : "default"}
                  variant={paymentMode === mode.value ? "solid" : "flat"}
                  className="flex-1"
                >
                  {mode.label}
                </Button>
              ))}
            </ButtonGroup>
          ) : (
            <span className="flex-1 text-xs text-default-400">Record from bill page later</span>
          )}

          <button
            type="button"
            onClick={() => setRecordPayment((prev) => !prev)}
            className={`shrink-0 text-xs font-medium transition-colors ${
              recordPayment ? "text-default-400 hover:text-default-600" : "text-primary"
            }`}
          >
            {recordPayment ? "Skip" : "Record"}
          </button>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button
          color="primary"
          size="lg"
          fullWidth
          isLoading={loading}
          onPress={handleSubmit}
          className="font-bold tracking-wide"
        >
          {loading
            ? "Creating..."
            : `${t("bills.quickCreate")}${amountDisplay ? ` · ${amountDisplay}` : ""}`}
        </Button>
      </div>
    </BottomSheet>
  );
}
