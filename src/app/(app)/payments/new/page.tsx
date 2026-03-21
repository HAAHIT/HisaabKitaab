"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Select,
  SelectItem,
} from "@heroui/react";
import { useRouter } from "next/navigation";

interface Party {
  id: string;
  name: string;
  type: string;
  currentBalance: number;
}

export default function RecordPaymentPage() {
  const router = useRouter();
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [partyId, setPartyId] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState("INCOMING");
  const [mode, setMode] = useState("CASH");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  const fetchParties = useCallback(async () => {
    try {
      const res = await fetch("/api/parties");
      const data = await res.json();
      setParties(data.parties || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchParties(); }, [fetchParties]);

  function showToast(message: string, t: "success" | "error") {
    setToast({ message, type: t });
    setTimeout(() => setToast(null), 3000);
  }

  const selectedParty = parties.find((p) => p.id === partyId);

  async function handleSave() {
    if (!partyId) { showToast("Select a party", "error"); return; }
    if (!amount || parseFloat(amount) <= 0) { showToast("Enter a valid amount", "error"); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partyId, amount, type: direction, mode, date, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast("Payment recorded!", "success");
      setTimeout(() => router.push("/payments"), 800);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save", "error");
    } finally { setSaving(false); }
  }

  return (
    <div className="p-4 lg:p-8 animate-fade-in max-w-2xl mx-auto">
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg animate-slide-up ${toast.type === "success" ? "bg-success text-white" : "bg-danger text-white"}`}>
          {toast.message}
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <Button isIconOnly variant="light" onPress={() => router.push("/payments")}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Record Payment</h1>
          <p className="text-default-500 text-sm mt-1">Track an incoming or outgoing payment</p>
        </div>
      </div>

      <Card shadow="sm" className="mb-6">
        <CardHeader className="px-6 pt-6 pb-0">
          <h2 className="font-semibold">Payment Details</h2>
        </CardHeader>
        <CardBody className="p-6 space-y-5">
          {/* Party Selection */}
          <Select
            label="Party"
            placeholder="Select customer or vendor"
            selectedKeys={partyId ? [partyId] : []}
            onSelectionChange={(keys) => {
              const v = Array.from(keys)[0] as string;
              if (v) setPartyId(v);
            }}
            variant="bordered"
            isRequired
            isLoading={loading}
          >
            {parties.map((p) => (
              <SelectItem key={p.id} textValue={p.name}>
                <div className="flex justify-between items-center w-full">
                  <span>{p.name}</span>
                  <span className="text-xs text-default-400 capitalize">{p.type.toLowerCase()}</span>
                </div>
              </SelectItem>
            ))}
          </Select>

          {/* Balance indicator */}
          {selectedParty && (
            <div className={`text-sm px-3 py-2 rounded-lg ${selectedParty.currentBalance > 0 ? "bg-danger/10 text-danger" : selectedParty.currentBalance < 0 ? "bg-success/10 text-success" : "bg-default-100 text-default-500"}`}>
              Current balance: <strong>₹{Math.abs(selectedParty.currentBalance).toLocaleString("en-IN")}</strong>
              {selectedParty.currentBalance > 0 ? " receivable" : selectedParty.currentBalance < 0 ? " advance" : " — settled"}
            </div>
          )}

          {/* Amount */}
          <Input
            label="Amount (₹)"
            placeholder="Enter amount"
            type="number"
            value={amount}
            onValueChange={setAmount}
            variant="bordered"
            size="lg"
            isRequired
            startContent={<span className="text-default-400 text-lg">₹</span>}
          />

          {/* Type & Mode */}
          <div className="grid grid-cols-2 gap-4">
            <Select label="Type" selectedKeys={[direction]} onSelectionChange={(keys) => { const v = Array.from(keys)[0] as string; if (v) setDirection(v); }} variant="bordered">
              <SelectItem key="INCOMING">💰 Received</SelectItem>
              <SelectItem key="OUTGOING">💸 Paid</SelectItem>
            </Select>
            <Select label="Payment Mode" selectedKeys={[mode]} onSelectionChange={(keys) => { const v = Array.from(keys)[0] as string; if (v) setMode(v); }} variant="bordered">
              <SelectItem key="CASH">💵 Cash</SelectItem>
              <SelectItem key="BANK_TRANSFER">🏦 Bank Transfer</SelectItem>
              <SelectItem key="UPI">📱 UPI</SelectItem>
              <SelectItem key="CHEQUE">📝 Cheque</SelectItem>
              <SelectItem key="OTHER">📋 Other</SelectItem>
            </Select>
          </div>

          {/* Date */}
          <Input label="Date" type="date" value={date} onValueChange={setDate} variant="bordered" />

          {/* Notes */}
          <Input label="Notes" placeholder="Optional notes..." value={notes} onValueChange={setNotes} variant="bordered" />
        </CardBody>
      </Card>

      <div className="flex gap-3 justify-end">
        <Button variant="flat" onPress={() => router.push("/payments")}>Cancel</Button>
        <Button color="primary" className="bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold" onPress={handleSave} isLoading={saving}>
          Record Payment
        </Button>
      </div>
    </div>
  );
}
