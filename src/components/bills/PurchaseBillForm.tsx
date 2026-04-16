"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Divider,
  Input,
  Select,
  SelectItem,
  Textarea,
  Checkbox,
} from "@heroui/react";
import { useRouter } from "next/navigation";
import { PartySearch, type PartyOption } from "@/components/ui/PartySearch";
import { useLanguage } from "@/contexts/LanguageContext";
import { GST_STATE_CODES } from "@/lib/gst-states";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

export function PurchaseBillForm() {
  const router = useRouter();
  const { t } = useLanguage();

  const [parties, setParties] = useState<PartyOption[]>([]);
  const [selectedParty, setSelectedParty] = useState<PartyOption | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [savingAs, setSavingAs] = useState<"DRAFT" | "FINAL" | null>(null);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Form State
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState("");
  const [billDate, setBillDate] = useState("");
  const [rows, setRows] = useState([{ description: "", hsn: "", rate: 0, qty: 1, amount: 0 }]);
  const [taxPercent, setTaxPercent] = useState(18);
  const [isInterState, setIsInterState] = useState(false);
  const [isReverseCharge, setIsReverseCharge] = useState(false);
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [notes, setNotes] = useState("");

  const fetchFormData = useCallback(async () => {
    setLoading(true);
    try {
      const partiesResponse = await fetch("/api/parties");
      const partiesData = await partiesResponse.json().catch(() => ({ parties: [] }));
      setParties((partiesData.parties || []) as PartyOption[]);
    } catch {
      showToast("Failed to load generic data", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFormData();
  }, [fetchFormData]);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }

  function addRow() {
    setRows((curr) => [...curr, { description: "", hsn: "", rate: 0, qty: 1, amount: 0 }]);
  }

  function removeRow(index: number) {
    if (rows.length <= 1) return;
    setRows((curr) => curr.filter((_, i) => i !== index));
  }

  function updateRow(index: number, field: string, value: string | number) {
    setRows((curr) => {
      const next = [...curr];
      (next[index] as any)[field] = value;
      if (field === "rate" || field === "qty") {
        next[index].amount = Number(next[index].rate || 0) * Number(next[index].qty || 0);
      }
      return next;
    });
  }

  const { subtotal, taxAmount, grandTotal } = useMemo(() => {
    const nextSubtotal = rows.reduce((sum, row) => sum + row.amount, 0);
    const nextTaxAmount = Math.round(((nextSubtotal * taxPercent) / 100) * 100) / 100;
    const nextGrandTotal = Math.round((nextSubtotal + nextTaxAmount) * 100) / 100;

    return {
      subtotal: nextSubtotal,
      taxAmount: nextTaxAmount,
      grandTotal: nextGrandTotal,
    };
  }, [rows, taxPercent]);

  async function handleSave(status: "DRAFT" | "FINAL") {
    const mainScroll = document.querySelector("main");

    const formErrors: Record<string, boolean> = {};
    if (!selectedParty) formErrors.partyId = true;
    if (status === "FINAL" && !placeOfSupply) formErrors.placeOfSupply = true;

    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      showToast("Please fill in required fields", "error");
      mainScroll?.scrollTo({ top: 0, behavior: "smooth" });
      window.setTimeout(() => setErrors({}), 3000);
      return;
    }

    setErrors({});
    setSavingAs(status);

    try {
      const response = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partyId: selectedParty!.id,
          supplierName: selectedParty!.name,
          supplierInvoiceNo,
          billDate: billDate ? new Date(billDate).toISOString() : undefined,
          rows: rows as any,
          subtotal,
          taxPercent,
          taxAmount,
          grandTotal,
          isInterState,
          isReverseCharge,
          placeOfSupply: placeOfSupply || null,
          notes: notes.trim() || null,
          status,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create purchase");
      }

      const data = await response.json();
      showToast(status === "FINAL" ? "Purchase Bill created" : "Draft saved", "success");
      window.setTimeout(() => {
        // Just redirect back to dashboard or purchases list
        router.push(`/bills/${data.bill.id}`);
      }, 700);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to save purchase bill", "error");
    } finally {
      setSavingAs(null);
    }
  }

  return (
    <>
      {toast && (
        <div
          className={`fixed right-4 top-4 z-[100] rounded-xl px-4 py-3 shadow-lg animate-slide-up ${
            toast.type === "success" ? "bg-success text-white" : "bg-danger text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="animate-fade-in p-4 lg:p-8 max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">New Purchase Bill</h1>
            <p className="mt-1 text-sm text-default-500">Record a new incoming purchase</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card shadow="sm">
            <CardHeader className="px-6 pt-6 pb-0">
              <h2 className="text-lg font-semibold">Vendor Details</h2>
            </CardHeader>
            <CardBody className="p-6">
              <PartySearch
                value={selectedParty?.id || null}
                onChange={(party) => {
                  setSelectedParty(party);
                  if (party && party.gstin && party.gstin.length >= 2) {
                    const code = party.gstin.substring(0, 2);
                    if (GST_STATE_CODES[code]) setPlaceOfSupply(code);
                  }
                }}
                partyType="VENDOR"
                placeholder="Select Vendor"
                isInvalid={Boolean(errors.partyId)}
              />

              {selectedParty && (
                <div className="mt-4 text-sm text-default-500">
                  {selectedParty.gstin && <p>GST: <span className="font-mono">{selectedParty.gstin}</span></p>}
                </div>
              )}
            </CardBody>
          </Card>

          <Card shadow="sm">
            <CardHeader className="px-6 pt-6 pb-0">
              <h2 className="text-lg font-semibold">Invoice Details</h2>
            </CardHeader>
            <CardBody className="p-6 space-y-4">
              <Input
                label="Supplier Invoice No"
                value={supplierInvoiceNo}
                onValueChange={setSupplierInvoiceNo}
                placeholder="e.g. INV-123"
                variant="bordered"
              />
              <Input
                label="Bill Date"
                type="date"
                value={billDate}
                onValueChange={setBillDate}
                variant="bordered"
              />
            </CardBody>
          </Card>
        </div>

        <Card shadow="sm" className="mb-6 overflow-hidden">
          <CardHeader className="flex items-center justify-between px-6 pt-6 pb-0">
            <h2 className="text-lg font-semibold">Line Items</h2>
            <Button size="sm" variant="flat" color="primary" onPress={addRow}> Add Row </Button>
          </CardHeader>
          <CardBody className="p-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-divider">
                  <th className="px-2 py-3 text-left font-medium text-default-500">Description</th>
                  <th className="px-2 py-3 text-left font-medium text-default-500 w-24">HSN/SAC</th>
                  <th className="px-2 py-3 text-left font-medium text-default-500 w-24">Rate</th>
                  <th className="px-2 py-3 text-left font-medium text-default-500 w-20">Qty</th>
                  <th className="px-2 py-3 text-left font-medium text-default-500 w-32">Amount</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index} className="border-b border-divider/30">
                    <td className="px-2 py-2">
                      <Input value={row.description} onValueChange={(v) => updateRow(index, "description", v)} variant="underlined" size="sm" />
                    </td>
                    <td className="px-2 py-2">
                      <Input value={row.hsn} onValueChange={(v) => updateRow(index, "hsn", v)} variant="underlined" size="sm" />
                    </td>
                    <td className="px-2 py-2">
                      <Input type="number" value={String(row.rate || "")} onValueChange={(v) => updateRow(index, "rate", v)} variant="underlined" size="sm" />
                    </td>
                    <td className="px-2 py-2">
                      <Input type="number" value={String(row.qty || "")} onValueChange={(v) => updateRow(index, "qty", v)} variant="underlined" size="sm" />
                    </td>
                    <td className="px-2 py-2 font-mono">{formatCurrency(row.amount)}</td>
                    <td className="px-2 py-2">
                      <Button isIconOnly size="sm" variant="light" color="danger" onPress={() => removeRow(index)} isDisabled={rows.length <= 1}>
                        X
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2 mb-6">
          <Card shadow="sm">
            <CardBody className="p-6 space-y-4">
              <Textarea label="Notes" placeholder="Additional notes..." value={notes} onValueChange={setNotes} variant="bordered" minRows={2} />
              <div className="flex flex-col gap-2">
                <Checkbox isSelected={isInterState} onValueChange={setIsInterState}>
                  Apply Inter-State Tax (IGST)
                </Checkbox>
                <Checkbox isSelected={isReverseCharge} onValueChange={setIsReverseCharge} color="warning">
                  Subject to Reverse Charge (RCM)
                </Checkbox>
              </div>
            </CardBody>
          </Card>

          <Card shadow="sm" className="bg-default-50">
            <CardBody className="p-6 space-y-3">
              <div className="flex justify-between text-default-500">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-default-500">
                  <span>Tax Amount</span>
                  <Input type="number" size="sm" variant="bordered" className="w-16" value={String(taxPercent)} onValueChange={(v) => setTaxPercent(Number(v))} endContent={<span className="text-xs">%</span>} />
                </div>
                <span>{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 pt-2">
                <span className={`text-sm ${errors.placeOfSupply ? 'text-danger font-medium' : 'text-default-500'}`}>
                  Place of Supply *
                </span>
                <Select aria-label="Place of supply" placeholder="Select state" size="sm" variant="bordered" className="max-w-[200px]" selectedKeys={placeOfSupply ? [placeOfSupply] : []} onSelectionChange={(k) => setPlaceOfSupply(Array.from(k)[0] as string)} isInvalid={errors.placeOfSupply}>
                  {Object.entries(GST_STATE_CODES).map(([code, name]) => (
                    <SelectItem key={code} textValue={`${code} - ${name}`}>{code} - {name}</SelectItem>
                  ))}
                </Select>
              </div>
              <Divider className="my-2" />
              <div className="flex justify-between text-lg font-bold">
                <span>Grand Total</span>
                <span className="text-primary">{formatCurrency(grandTotal)}</span>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="flex justify-end gap-3 pb-8">
          <Button variant="bordered" onPress={() => router.back()}>Cancel</Button>
          <Button variant="flat" onPress={() => handleSave("DRAFT")} isLoading={savingAs === "DRAFT"}>Save Draft</Button>
          <Button color="primary" onPress={() => handleSave("FINAL")} isLoading={savingAs === "FINAL"}>Confirm Purchase</Button>
        </div>
      </div>
    </>
  );
}
