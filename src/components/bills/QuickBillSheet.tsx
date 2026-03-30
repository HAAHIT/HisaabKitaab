"use client";

import { useState, useEffect } from "react";
import { Button, Input, ButtonGroup } from "@heroui/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { PartySearch, PartyOption } from "@/components/ui/PartySearch";

interface QuickBillSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onBillCreated?: (bill: { id: string; billNumber: string }) => void;
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
  const [paymentMode, setPaymentMode] = useState<"CASH" | "UPI" | "BANK" | "CHEQUE">("CASH");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-fetch last bill description
  useEffect(() => {
    if (!selectedParty) return;

    fetch(`/api/bills?partyId=${selectedParty.id}&limit=1`)
      .then((res) => res.json())
      .then((data) => {
        if (data.bills?.[0]) {
          const lastDesc = data.bills[0].rows?.[0]?.description;
          if (lastDesc && !description) {
            setDescription(lastDesc);
          }
        }
      })
      .catch((e) => console.error("Could not fetch last bill", e));
  }, [selectedParty]);

  async function handleSubmit() {
    if (!selectedParty) {
      setError("Please select a party.");
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
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
          customerPhone: selectedParty.phone,
          customerAddress: selectedParty.address,
          gstin: selectedParty.gstin,
          rows: [{ description: description || "Quick Bill", amount: parsedAmount }],
          subtotal: parsedAmount,
          taxPercent: 0,
          taxAmount: 0,
          grandTotal: parsedAmount,
          status: "FINAL",
          paymentMode: paymentMode,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create quick bill");
      }

      const data = await response.json();
      
      // reset
      setSelectedParty(null);
      setAmount("");
      setDescription("");
      setPaymentMode("CASH");
      
      onClose();
      if (onBillCreated) {
        onBillCreated({ id: data.bill.id, billNumber: data.bill.billNumber });
      }
    } catch (err) {
      setError("An error occurred while creating the bill.");
    } finally {
      setLoading(false);
    }
  }

  const amountDisplay = amount ? `₹${parseFloat(amount).toLocaleString("en-IN")}` : "";

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Quick Bill">
      <div className="flex flex-col gap-5 p-4 pb-safe-bottom">
        <PartySearch
          value={selectedParty?.id || null}
          onChange={setSelectedParty}
          partyType="CUSTOMER"
          placeholder="Search party..."
        />

        <Input
          size="lg"
          type="number"
          inputMode="decimal"
          label="Amount (₹)"
          placeholder="0.00"
          value={amount}
          onValueChange={setAmount}
          autoFocus={true}
          classNames={{
            input: "text-3xl font-bold",
          }}
          isInvalid={!!error && !amount}
        />

        <Input
          label="Description (optional)"
          placeholder="e.g. Hardware supplies"
          value={description}
          onValueChange={setDescription}
        />

        <div className="flex flex-col gap-2">
          <label className="text-sm text-default-600 font-medium">Payment Mode</label>
          <ButtonGroup fullWidth size="md">
            {["CASH", "UPI", "BANK", "CHEQUE"].map((mode) => (
              <Button
                key={mode}
                onPress={() => setPaymentMode(mode as any)}
                color={paymentMode === mode ? "primary" : "default"}
                variant={paymentMode === mode ? "solid" : "flat"}
              >
                {mode}
              </Button>
            ))}
          </ButtonGroup>
        </div>

        {error && <p className="text-danger text-sm">{error}</p>}

        <Button
          color="primary"
          size="lg"
          fullWidth
          isLoading={loading}
          onPress={handleSubmit}
          className="mt-4 font-bold tracking-wide"
        >
          {loading ? "Creating..." : `Create Bill ${amountDisplay}`}
        </Button>
      </div>
    </BottomSheet>
  );
}
