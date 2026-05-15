"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
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
import { HKButton } from "@/components/ui/HKButton";
import { HKInput } from "@/components/ui/HKInput";
import { useRouter } from "next/navigation";
import { PartySearch, type PartyOption } from "@/components/ui/PartySearch";
import { useLanguage } from "@/contexts/LanguageContext";
import { evaluateRow, type ColumnDef } from "@/lib/formula";
import { GST_STATE_CODES } from "@/lib/gst-states";

interface Template {
  id: string;
  name: string;
  columns: ColumnDef[];
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatColumnValue(columnName: string, value: number) {
  const lower = columnName.toLowerCase();
  const isCurrency =
    lower.includes("rate") ||
    lower.includes("price") ||
    lower.includes("amount") ||
    lower.includes("total") ||
    lower.includes("rs");

  if (isCurrency) {
    return formatCurrency(value);
  }

  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(value);
}

function buildEmptyRow(template: Template) {
  return template.columns.reduce<Record<string, string | number>>((row, column) => {
    row[column.id] = column.type === "number" || column.type === "formula" ? 0 : "";
    return row;
  }, {});
}

export function PurchaseBillForm() {
  const router = useRouter();
  const { t } = useLanguage();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingAs, setSavingAs] = useState<"DRAFT" | "FINAL" | null>(null);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Form State
  const [selectedParty, setSelectedParty] = useState<PartyOption | null>(null);
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState("");
  const [billDate, setBillDate] = useState("");
  const [rows, setRows] = useState<Record<string, string | number>[]>([]);
  const [taxPercent, setTaxPercent] = useState(18);
  const [isInterState, setIsInterState] = useState(false);
  const [isReverseCharge, setIsReverseCharge] = useState(false);
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [notes, setNotes] = useState("");

  const fetchFormData = useCallback(async () => {
    setLoading(true);
    try {
      const [templRes, setRes] = await Promise.all([
        fetch("/api/templates"),
        fetch("/api/settings"),
      ]);
      const [tData, sData] = await Promise.all([templRes.json(), setRes.json()]);
      
      setTemplates(tData.templates || []);
      if (sData.settings) {
         setTaxPercent(sData.settings.defaultTaxPercent || 18);
      }
    } catch {
      showToast("Failed to load form data", "error");
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

  const selectTemplate = useCallback((templateId: string) => {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    setSelectedTemplate(template);
    setRows([buildEmptyRow(template)]);
  }, [templates]);

  // Auto-select template if only one exists (just like Sales bill)
  useEffect(() => {
    if (templates.length === 1 && !selectedTemplate) {
      selectTemplate(templates[0].id);
    }
  }, [selectTemplate, selectedTemplate, templates]);

  function addRow() {
    if (!selectedTemplate) return;
    setRows((curr) => [...curr, buildEmptyRow(selectedTemplate)]);
  }

  function removeRow(index: number) {
    if (rows.length <= 1) return;
    setRows((curr) => curr.filter((_, i) => i !== index));
  }

  function updateCell(rowIndex: number, columnId: string, value: string) {
    setRows((currentRows) => {
      const nextRows = [...currentRows];
      const column = selectedTemplate?.columns.find((item) => item.id === columnId);

      if (column?.type === "number") {
        nextRows[rowIndex][columnId] = value === "" ? 0 : Number.parseFloat(value) || 0;
      } else {
        nextRows[rowIndex][columnId] = value;
      }

      if (selectedTemplate) {
        nextRows[rowIndex] = evaluateRow(nextRows[rowIndex], selectedTemplate.columns);
      }

      return nextRows;
    });
  }

  const { subtotal, taxAmount, grandTotal } = useMemo(() => {
    if (!selectedTemplate) return { subtotal: 0, taxAmount: 0, grandTotal: 0 };

    const lastValueColumn = [...selectedTemplate.columns]
      .reverse()
      .find((column) => column.type === "formula" || column.type === "number");

    if (!lastValueColumn) return { subtotal: 0, taxAmount: 0, grandTotal: 0 };

    const nextSubtotal = rows.reduce((sum, row) => {
      const value = typeof row[lastValueColumn.id] === "number" ? (row[lastValueColumn.id] as number) : 0;
      return sum + value;
    }, 0);

    const nextTaxAmount = Math.round(((nextSubtotal * taxPercent) / 100) * 100) / 100;
    const nextGrandTotal = Math.round((nextSubtotal + nextTaxAmount) * 100) / 100;

    return { subtotal: nextSubtotal, taxAmount: nextTaxAmount, grandTotal: nextGrandTotal };
  }, [rows, selectedTemplate, taxPercent]);

  async function handleSave(status: "DRAFT" | "FINAL") {
    if (!selectedTemplate) {
      showToast("Please select a template", "error");
      return;
    }

    const formErrors: Record<string, boolean> = {};
    if (!selectedParty) formErrors.partyId = true;
    if (status === "FINAL" && !placeOfSupply) formErrors.placeOfSupply = true;

    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      showToast("Please fill in required fields", "error");
      return;
    }

    setSavingAs(status);
    try {
      const response = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          partyId: selectedParty!.id,
          supplierName: selectedParty!.name,
          supplierInvoiceNo,
          billDate: billDate ? new Date(billDate).toISOString() : undefined,
          rows,
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
      window.setTimeout(() => router.push(`/bills/${data.bill.id}`), 700);
    } catch (error: any) {
      showToast(error.message, "error");
    } finally {
      setSavingAs(null);
    }
  }

  return (
    <>
      {toast && (
        <div className={`fixed right-4 top-4 z-[100] rounded-xl px-4 py-3 shadow-lg animate-slide-up ${
          toast.type === "success" ? "bg-success text-white" : "bg-danger text-white"
        }`}>
          {toast.message}
        </div>
      )}

      <div className="animate-fade-in p-4 lg:p-8">
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-default-100 transition-colors text-default-600"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold">New Purchase Bill</h1>
            <p className="mt-1 text-sm text-default-500">Record a new incoming purchase from a supplier.</p>
          </div>
        </div>

        {!selectedTemplate && (
          <Card shadow="sm" className="mb-6">
            <CardBody className="p-6">
              <h2 className="mb-4 text-lg font-semibold text-default-900">Choose Template</h2>
              {loading ? (
                <p className="text-default-400">Loading templates...</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => selectTemplate(template.id)}
                      className="group relative w-full rounded-2xl border border-default-200 bg-content1 p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-primary-300/60 hover:bg-primary-500/[0.04] hover:shadow-[0_12px_28px_-20px_rgba(59,130,246,0.9)]"
                    >
                      <div className="flex items-start gap-3">
                        <div className="rounded-xl bg-primary-100 p-3 text-primary transition-colors group-hover:bg-primary group-hover:text-white dark:bg-primary/15">
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="M9 12h6m-6 4h6M8 4h8a2 2 0 012 2v12a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} />
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-semibold text-default-900">{template.name}</p>
                          <p className="mt-1 text-xs text-default-500">{template.columns.length} columns</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        )}

        {selectedTemplate && (
          <>
            <div className="mb-4 flex items-center gap-2">
              <Chip size="sm" color="primary" variant="flat">{selectedTemplate.name}</Chip>
              <HKButton variant="ghost" size="sm" onClick={() => setSelectedTemplate(null)}>Change Template</HKButton>
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
                      if (party?.gstin && party.gstin.length >= 2) {
                        const code = party.gstin.substring(0, 2);
                        if (GST_STATE_CODES[code]) setPlaceOfSupply(code);
                      }
                    }}
                    partyType="VENDOR"
                    placeholder="Search Supplier..."
                    isInvalid={Boolean(errors.partyId)}
                  />

                  {selectedParty && (
                    <div className="mt-4 rounded-xl bg-default-50 dark:bg-default-100/5 p-4 border border-default-200 animate-slide-up">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-lg text-default-900">{selectedParty.name}</h3>
                        <HKButton variant="ghost" size="sm" onClick={() => setSelectedParty(null)}>Change</HKButton>
                      </div>
                      <div className="space-y-1 text-sm text-default-500">
                        {selectedParty.phone && <p>📱 {selectedParty.phone}</p>}
                        {selectedParty.address && <p>📍 {selectedParty.address}</p>}
                        {selectedParty.gstin && <p><span className="text-xs font-mono font-bold text-default-400">GST</span> {selectedParty.gstin}</p>}
                      </div>
                      {selectedParty.currentBalance !== 0 && (
                        <div className={`mt-3 pt-3 border-t border-default-200 text-sm font-medium ${selectedParty.currentBalance > 0 ? "text-danger" : "text-success"}`}>
                          {selectedParty.currentBalance > 0 ? `To Pay: ₹${selectedParty.currentBalance.toLocaleString("en-IN")}` : `Advance: ₹${Math.abs(selectedParty.currentBalance).toLocaleString("en-IN")}`}
                        </div>
                      )}
                    </div>
                  )}
                </CardBody>
              </Card>

              <Card shadow="sm">
                <CardHeader className="px-6 pt-6 pb-0">
                  <h2 className="text-lg font-semibold">Invoice Details</h2>
                </CardHeader>
                <CardBody className="p-6 space-y-4">
                  <HKInput label="Supplier Invoice No" value={supplierInvoiceNo} onValueChange={setSupplierInvoiceNo} placeholder="e.g. INV/2024/001" />
                  <HKInput label="Bill Date" type="date" value={billDate} onValueChange={setBillDate} />
                </CardBody>
              </Card>
            </div>

            <Card shadow="sm" className="mb-6">
              <CardHeader className="flex items-center justify-between px-6 pt-6 pb-0">
                <h2 className="text-lg font-semibold">Line Items</h2>
                <HKButton size="sm" startContent={<svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></svg>} onClick={addRow}>Add Row</HKButton>
              </CardHeader>
              <CardBody className="overflow-x-auto p-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-divider">
                      <th className="w-10 px-2 py-3 text-left font-medium text-default-500">#</th>
                      {selectedTemplate.columns.map((col) => (
                        <th key={col.id} className="px-2 py-3 text-left font-medium text-default-500">
                          {col.name} {col.type === "formula" && <span className="text-xs text-warning">fx</span>}
                        </th>
                      ))}
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, rIdx) => (
                      <tr key={rIdx} className="border-b border-divider/30 hover:bg-default-50">
                        <td className="px-2 py-2 text-default-400">{rIdx + 1}</td>
                        {selectedTemplate.columns.map((col) => (
                          <td key={col.id} className="px-2 py-2">
                            {col.type === "formula" ? (
                              <span className="font-mono font-medium text-success">
                                {typeof row[col.id] === "number" ? formatColumnValue(col.name, row[col.id] as number) : "-"}
                              </span>
                            ) : col.type === "number" ? (
                              <Input type="number" value={String(row[col.id] || "")} onValueChange={(v) => updateCell(rIdx, col.id, v)} variant="underlined" size="sm" className="min-w-[80px]" />
                            ) : (
                              <Input type="text" value={String(row[col.id] || "")} onValueChange={(v) => updateCell(rIdx, col.id, v)} variant="underlined" size="sm" className="min-w-[120px]" />
                            )}
                          </td>
                        ))}
                        <td className="px-2 py-2">
                          <button
                            onClick={() => removeRow(rIdx)}
                            disabled={rows.length <= 1}
                            aria-label="Remove row"
                            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-danger/10 text-default-400 hover:text-danger disabled:opacity-40 disabled:pointer-events-none transition-colors"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} /></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardBody>
            </Card>

            <div className="mb-6 grid gap-6 lg:grid-cols-2">
              <Card shadow="sm">
                <CardBody className="space-y-4 p-6">
                  <Textarea label="Notes" placeholder="Additional notes..." value={notes} onValueChange={setNotes} variant="bordered" minRows={2} />
                  <div className="flex flex-col gap-2">
                    <Checkbox isSelected={isInterState} onValueChange={setIsInterState}>Inter-State Transaction (IGST)</Checkbox>
                    <Checkbox isSelected={isReverseCharge} onValueChange={setIsReverseCharge} color="warning">Subject to Reverse Charge (RCM)</Checkbox>
                  </div>
                </CardBody>
              </Card>

              <Card shadow="sm" className="bg-gradient-to-br from-blue-500/5 to-indigo-500/5">
                <CardBody className="p-6 space-y-3">
                  <h3 className="mb-2 text-lg font-semibold">Summary</h3>
                  <div className="flex justify-between text-default-500">
                    <span>Subtotal</span>
                    <span className="font-medium text-default-900">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-default-500">Tax</span>
                      <HKInput type="number" size="sm" className="w-20" value={String(taxPercent)} onValueChange={(v) => setTaxPercent(Number(v))} endContent={<span className="text-xs">%</span>} />
                    </div>
                    <span className="font-medium text-default-900">{formatCurrency(taxAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <span className={`text-sm ${errors.placeOfSupply ? 'text-danger font-medium' : 'text-default-500'}`}>Place of Supply *</span>
                    <Select aria-label="POS" placeholder="Select" size="sm" variant="bordered" className="max-w-[180px]" selectedKeys={placeOfSupply ? [placeOfSupply] : []} onSelectionChange={(k) => setPlaceOfSupply(Array.from(k)[0] as string)} isInvalid={errors.placeOfSupply}>
                      {Object.entries(GST_STATE_CODES).map(([c, n]) => <SelectItem key={c} textValue={`${c} - ${n}`}>{c} - {n}</SelectItem>)}
                    </Select>
                  </div>
                  <Divider />
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-lg font-bold text-default-900">Grand Total</span>
                    <span className="text-2xl font-bold text-primary">{formatCurrency(grandTotal)}</span>
                  </div>
                </CardBody>
              </Card>
            </div>

            <div className="flex justify-end gap-3 pb-8">
              <HKButton variant="secondary" onClick={() => router.back()}>Cancel</HKButton>
              <HKButton variant="secondary" isLoading={savingAs === "DRAFT"} onClick={() => handleSave("DRAFT")}>Save Draft</HKButton>
              <HKButton isLoading={savingAs === "FINAL"} onClick={() => handleSave("FINAL")}>Confirm Purchase</HKButton>
            </div>
          </>
        )}
      </div>
    </>
  );
}
