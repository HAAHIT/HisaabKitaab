"use client";

import { useEffect, useState } from "react";
import { Button, ButtonGroup, Input } from "@heroui/react";
import BottomSheet from "@/components/ui/BottomSheet";
import { PartySearch, type PartyOption } from "@/components/ui/PartySearch";
import { useLanguage } from "@/contexts/LanguageContext";

const QUICK_BILL_PAYMENT_MODES = [
  { label: "CASH", value: "CASH" },
  { label: "UPI", value: "UPI" },
  { label: "BANK", value: "BANK_TRANSFER" },
  { label: "CHEQUE", value: "CHEQUE" },
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

  return `${parts[0]}.${parts.slice(1).join("").slice(0, 2)}`;
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedParty) {
      return;
    }

    fetch(`/api/bills?partyId=${selectedParty.id}&limit=1`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.bills?.[0]) {
          return;
        }

        const lastDesc = data.bills[0].rows?.[0]?.description;
        if (lastDesc && !description) {
          setDescription(lastDesc);
        }
      })
      .catch((fetchError) => {
        console.error("Could not fetch last bill", fetchError);
      });
  }, [description, selectedParty]);

  useEffect(() => {
    if (isOpen) {
      setError(null);
    }
  }, [isOpen]);

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
          rows: [{ description: description || "Quick Bill", amount: parsedAmount }],
          subtotal: parsedAmount,
          taxPercent: 0,
          taxAmount: 0,
          grandTotal: parsedAmount,
          status: "FINAL",
          paymentMode,
        }),
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const data = await response.json();

      setSelectedParty(null);
      setAmount("");
      setDescription("");
      setPaymentMode("CASH");

      onClose();
      onBillCreated?.({ id: data.bill.id, billNumber: data.bill.billNumber });
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
      ? `INR ${parsedAmount.toLocaleString("en-IN")}`
      : "";

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={t("bills.quickBill")}>
      <div className="flex flex-col gap-5 p-4 pb-safe-bottom">
        <PartySearch
          value={selectedParty?.id || null}
          onChange={setSelectedParty}
          partyType="CUSTOMER"
          placeholder={t("bills.quickSearchParty")}
          autoFocus
        />

        <Input
          size="lg"
          type="text"
          inputMode="decimal"
          label={t("bills.quickAmount")}
          placeholder="0.00"
          value={amount}
          onValueChange={(value) => setAmount(sanitizeAmountInput(value))}
          classNames={{
            input: "text-3xl font-bold",
          }}
          isInvalid={Boolean(error) && !amount}
        />

        <Input
          label={t("bills.quickDescription")}
          placeholder="e.g. Hardware supplies"
          value={description}
          onValueChange={setDescription}
        />

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-default-600">Payment Mode</label>
          <ButtonGroup fullWidth size="md">
            {QUICK_BILL_PAYMENT_MODES.map((mode) => (
              <Button
                key={mode.value}
                onPress={() => setPaymentMode(mode.value)}
                color={paymentMode === mode.value ? "primary" : "default"}
                variant={paymentMode === mode.value ? "solid" : "flat"}
              >
                {mode.label}
              </Button>
            ))}
          </ButtonGroup>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button
          color="primary"
          size="lg"
          fullWidth
          isLoading={loading}
          onPress={handleSubmit}
          className="mt-4 font-bold tracking-wide"
        >
          {loading
            ? "Creating..."
            : `${t("bills.quickCreate")}${amountDisplay ? ` ${amountDisplay}` : ""}`}
        </Button>
      </div>
    </BottomSheet>
  );
}
