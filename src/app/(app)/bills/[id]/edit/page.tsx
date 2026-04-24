"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  Chip,
  Divider,
  Input,
  Select,
  SelectItem,
  Textarea,
} from "@heroui/react";
import { useRouter } from "next/navigation";
import { PartySearch, type PartyOption } from "@/components/ui/PartySearch";
import { ItemSearch } from "@/components/ui/ItemSearch";
import { StateSearch } from "@/components/ui/StateSearch";
import { useLanguage } from "@/contexts/LanguageContext";
import { evaluateRow, type ColumnDef } from "@/lib/formula";
import { GST_STATE_CODES } from "@/lib/gst-states";
import { extractGstinStateCode, isValidGstinFormat } from "@/lib/gst-helpers";

interface Template {
  id: string;
  name: string;
  columns: ColumnDef[];
}

// PartyOption is now imported from PartySearch component

interface BillResponse {
  id: string;
  templateId: string;
  partyId: string | null;
  isInterState?: boolean;
  placeOfSupply?: string | null;
  customerName: string;
  customerPhone: string | null;
  customerAddress: string | null;
  gstin: string | null;
  rows: Record<string, string | number>[];
  notes: string | null;
  terms: string | null;
  taxPercent: number;
  hsnCode?: string | null;
  roundOff?: number;
  shippingAddress?: string | null;
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

async function readError(response: Response) {
  const data = await response.json().catch(() => null);
  return data?.error || "Request failed";
}

function buildEmptyRow(template: Template) {
  return template.columns.reduce<Record<string, string | number>>((row, column) => {
    row[column.id] = column.type === "number" || column.type === "formula" ? 0 : "";
    return row;
  }, {});
}

export default function EditBillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { t } = useLanguage();

  const [selectedParty, setSelectedParty] = useState<PartyOption | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [bill, setBill] = useState<BillResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingAs, setSavingAs] = useState<"DRAFT" | "FINAL" | null>(null);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // partyId is derived from selectedParty
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [gstin, setGstin] = useState("");
  const [rows, setRows] = useState<Record<string, string | number>[]>([]);
  const [isInterState, setIsInterState] = useState(false);
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [tenantGstin, setTenantGstin] = useState<string | null>(null);
  const [enableRoundOff, setEnableRoundOff] = useState(false);
  const [shippingAddress, setShippingAddress] = useState("");
  const [showShipTo, setShowShipTo] = useState(false);

  const fetchFormData = useCallback(async () => {
    setLoading(true);
    try {
      const [billResponse, templatesResponse, partiesResponse, settingsResponse] = await Promise.all([
        fetch(`/api/bills/${id}`),
        fetch("/api/templates"),
        fetch("/api/parties"),
        fetch("/api/settings"),
      ]);

      if (!billResponse.ok) {
        throw new Error(await readError(billResponse));
      }

      const [billData, templatesData, partiesData, settingsData] = await Promise.all([
        billResponse.json(),
        templatesResponse.json().catch(() => ({ templates: [] })),
        partiesResponse.json().catch(() => ({ parties: [] })),
        settingsResponse.json().catch(() => ({ settings: null })),
      ]);

      if (settingsData.settings?.companyGstin) {
        setTenantGstin(settingsData.settings.companyGstin);
      }

      const nextBill = billData.bill as BillResponse;
      const nextTemplates = (templatesData.templates || []) as Template[];

      setBill(nextBill);
      setCustomerName(nextBill.customerName);
      setCustomerPhone(nextBill.customerPhone || "");
      setCustomerAddress(nextBill.customerAddress || "");
      setGstin(nextBill.gstin || "");
      setRows(Array.isArray(nextBill.rows) ? nextBill.rows : []);
      setNotes(nextBill.notes || "");
      setTerms(nextBill.terms || "");
      setIsInterState(nextBill.isInterState === true);
      setPlaceOfSupply(nextBill.placeOfSupply || "");
      // Seed round-off / ship-to from existing bill data
      if (nextBill.roundOff && nextBill.roundOff !== 0) {
        setEnableRoundOff(true);
      }
      if (nextBill.shippingAddress) {
        setShowShipTo(true);
        setShippingAddress(nextBill.shippingAddress);
      }

      // Pre-seed party from bill data for the PartySearch component
      if (nextBill.partyId) {
        setSelectedParty({
          id: nextBill.partyId,
          name: nextBill.customerName,
          phone: nextBill.customerPhone,
          type: "CUSTOMER",
          currentBalance: 0,
          address: nextBill.customerAddress,
          gstin: nextBill.gstin,
        });
      }

      const template = nextTemplates.find((item) => item.id === nextBill.templateId) || null;
      setSelectedTemplate(template);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to load bill", "error");
      window.setTimeout(() => router.push("/bills"), 1200);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchFormData();
  }, [fetchFormData]);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }

  function applyPartySnapshot(party: PartyOption | null) {
    setSelectedParty(party);
    if (!party) {
      return;
    }

    setCustomerName(party.name);
    setCustomerPhone(party.phone || "");
    setCustomerAddress(party.address || "");
    setGstin(party.gstin || "");
    // Auto-fill place of supply from first 2 digits of customer GSTIN
    if (party.gstin && party.gstin.length >= 2) {
      const code = party.gstin.substring(0, 2);
      if (GST_STATE_CODES[code]) setPlaceOfSupply(code);
    }
    // Auto-derive interstate from GSTIN comparison
    const partyState = extractGstinStateCode(party.gstin);
    const tenantState = extractGstinStateCode(tenantGstin);
    if (partyState && tenantState) {
      setIsInterState(partyState !== tenantState);
    }
    setErrors((currentErrors) => ({
      ...currentErrors,
      partyId: false,
      customerName: false,
    }));
  }

  function addRow() {
    if (!selectedTemplate) {
      return;
    }

    setRows((currentRows) => [...currentRows, buildEmptyRow(selectedTemplate)]);
  }

  function removeRow(index: number) {
    if (rows.length <= 1) {
      return;
    }

    setRows((currentRows) => currentRows.filter((_, rowIndex) => rowIndex !== index));
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
    if (!selectedTemplate) {
      return { subtotal: 0, taxAmount: 0, grandTotal: 0 };
    }

    const lastValueColumn = [...selectedTemplate.columns]
      .reverse()
      .find((column) => column.type === "formula" || column.type === "number");

    if (!lastValueColumn) {
      return { subtotal: 0, taxAmount: 0, grandTotal: 0 };
    }

    let nextGrandTotal = 0;
    let nextTaxAmount = 0;

    rows.forEach(row => {
      const amountCol = selectedTemplate.columns.find(c => c.id === "col_amount" || c.name.toLowerCase() === "total" || c.name.toLowerCase() === "amount") || lastValueColumn;
      if (typeof row[amountCol.id] === "number") {
        nextGrandTotal += row[amountCol.id] as number;
      }

      const taxAmountCol = selectedTemplate.columns.find(c => c.id === "col_tax_amount" || c.name.toLowerCase() === "tax amount" || c.name.toLowerCase() === "gst amount");
      if (taxAmountCol && typeof row[taxAmountCol.id] === "number") {
        nextTaxAmount += row[taxAmountCol.id] as number;
      }
    });

    nextGrandTotal = Math.round(nextGrandTotal * 100) / 100;
    nextTaxAmount = Math.round(nextTaxAmount * 100) / 100;
    const nextSubtotal = Math.round((nextGrandTotal - nextTaxAmount) * 100) / 100;

    return {
      subtotal: nextSubtotal,
      taxAmount: nextTaxAmount,
      grandTotal: nextGrandTotal,
    };
  }, [rows, selectedTemplate]);

  const roundOff = useMemo(() => {
    if (!enableRoundOff) return 0;
    return Math.round((Math.round(grandTotal) - grandTotal) * 100) / 100;
  }, [enableRoundOff, grandTotal]);

  const roundedGrandTotal = useMemo(() => {
    return enableRoundOff ? Math.round(grandTotal) : grandTotal;
  }, [enableRoundOff, grandTotal]);

  async function handleSave(status: "DRAFT" | "FINAL") {
    const mainScroll = document.querySelector("main");

    if (!selectedTemplate || !bill) {
      showToast("Please wait for bill data to load", "error");
      mainScroll?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const formErrors: Record<string, boolean> = {};
    if (!selectedParty) {
      formErrors.partyId = true;
    }
    if (!customerName.trim()) {
      formErrors.customerName = true;
    }
    if (status === "FINAL" && !placeOfSupply) {
      formErrors.placeOfSupply = true;
    }

    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      showToast("Please fill in required fields (Place of Supply is mandatory for final bills)", "error");
      mainScroll?.scrollTo({ top: 0, behavior: "smooth" });
      window.setTimeout(() => setErrors({}), 3000);
      return;
    }

    setErrors({});
    setSavingAs(status);

    try {
      const response = await fetch(`/api/bills/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partyId: selectedParty!.id,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim() || null,
          customerAddress: customerAddress.trim() || null,
          gstin: gstin.trim() || null,
          rows,
          notes: notes.trim() || null,
          terms: terms.trim() || null,
          taxPercent: 0,
          subtotal,
          taxAmount,
          grandTotal: roundedGrandTotal,
          roundOff,
          shippingAddress: showShipTo ? shippingAddress.trim() || null : null,
          isInterState,
          hsnCode: null,
          placeOfSupply: placeOfSupply.trim() || null,
          status,
        }),
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      showToast(
        `Bill updated and ${status === "DRAFT" ? "saved as draft" : "finalized"}!`,
        "success"
      );
      window.setTimeout(() => router.push(`/bills/${id}`), 700);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to update bill", "error");
    } finally {
      setSavingAs(null);
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-default-500">Loading bill data...</div>;
  }

  if (!bill || !selectedTemplate) {
    return <div className="p-8 text-center text-default-500">Bill not found</div>;
  }

  return (
    <>
      {toast && (
        <div
          className={`fixed right-4 top-4 z-[100] rounded-xl px-4 py-3 shadow-lg animate-slide-up ${toast.type === "success" ? "bg-success text-white" : "bg-danger text-white"
            }`}
        >
          {toast.message}
        </div>
      )}

      <div className="animate-fade-in p-4 lg:p-8">
        <div className="mb-6 flex items-center gap-3">
          <Button
            isIconOnly
            variant="light"
            aria-label="Back to bill details"
            onPress={() => router.push(`/bills/${id}`)}
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
            <h1 className="text-2xl font-bold">Edit Bill</h1>
            <p className="mt-1 text-sm text-default-500">
              Update the linked party and the stored invoice snapshot together.
            </p>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <Chip size="sm" color="primary" variant="flat">
            {selectedTemplate.name}
          </Chip>
        </div>

        <Card shadow="sm" className="mb-6">
          <CardHeader className="px-6 pt-6 pb-0">
            <h2 className="text-lg font-semibold">Bill To</h2>
          </CardHeader>
          <CardBody className="space-y-4 p-6">
            <PartySearch
              value={selectedParty?.id || null}
              onChange={applyPartySnapshot}
              placeholder="Search customer or vendor…"
              isInvalid={Boolean(errors.partyId)}
              initialParty={selectedParty}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label={t("bills.customer")}
                placeholder="Invoice display name"
                value={customerName}
                onValueChange={(value) => {
                  setCustomerName(value);
                  if (value.trim()) {
                    setErrors((currentErrors) => ({
                      ...currentErrors,
                      customerName: false,
                    }));
                  }
                }}
                variant="bordered"
                isRequired
                isInvalid={Boolean(errors.customerName)}
                errorMessage={errors.customerName ? "Customer name is required" : undefined}
                classNames={{
                  inputWrapper: errors.customerName
                    ? "animate-pulse border-danger bg-danger/10"
                    : "",
                }}
              />
              <Input
                label="Phone"
                placeholder="Phone number"
                value={customerPhone}
                onValueChange={setCustomerPhone}
                variant="bordered"
                type="tel"
              />
              <Input
                label="Address"
                placeholder="Billing address"
                value={customerAddress}
                onValueChange={setCustomerAddress}
                variant="bordered"
              />
              <Input
                label="GSTIN"
                placeholder="GST Number (optional)"
                value={gstin}
                onValueChange={(v) => setGstin(v.toUpperCase())}
                variant="bordered"
                isInvalid={gstin.trim().length > 0 && !isValidGstinFormat(gstin)}
                errorMessage={gstin.trim().length > 0 && !isValidGstinFormat(gstin) ? "Invalid GSTIN format (15 chars: 22AAAAA0000A1Z5)" : undefined}
                maxLength={15}
              />
            </div>
          </CardBody>
        </Card>

        <Card shadow="sm" className="mb-6">
          <CardHeader className="flex items-center justify-between px-6 pt-6 pb-0">
            <div className="flex gap-4 items-center">
              <h2 className="text-lg font-semibold">Line Items</h2>
              <StateSearch
                value={placeOfSupply}
                onChange={(code) => {
                  setPlaceOfSupply(code);
                  if (code) {
                    setErrors((curr) => ({ ...curr, placeOfSupply: false }));
                  }
                }}
                isInvalid={Boolean(errors.placeOfSupply)}
                errorMessage={errors.placeOfSupply ? "Required for final bills" : undefined}
                className="w-[200px]"
                placeholder="Place of Supply (State)"
              />
            </div>
            <Button
              size="sm"
              variant="flat"
              color="primary"
              onPress={addRow}
              startContent={
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M12 4v16m8-8H4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
              }
            >
              Add Row
            </Button>
          </CardHeader>
          <CardBody className="overflow-x-auto p-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-divider">
                  <th className="w-10 px-2 py-3 text-left font-medium text-default-500">#</th>
                  {selectedTemplate.columns.map((column) => (
                    <th
                      key={column.id}
                      className="px-2 py-3 text-left font-medium text-default-500"
                    >
                      <div className="flex items-center gap-1">
                        {column.name}
                        {column.type === "formula" && (
                          <span className="text-xs text-warning">fx</span>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className="border-b border-divider/30 hover:bg-default-50 dark:hover:bg-default-100/5"
                  >
                    <td className="px-2 py-2 text-default-400">{rowIndex + 1}</td>
                    {selectedTemplate.columns.map((column) => (
                      <td key={column.id} className="px-2 py-2">
                        {column.type === "formula" ? (
                          <span className="font-mono font-medium text-success">
                            {(() => {
                              const raw = row[column.id];
                              const num = typeof raw === "number" ? raw : parseFloat(String(raw));
                              return !isNaN(num) ? formatColumnValue(column.name, num) : "-";
                            })()}
                          </span>
                        ) : column.type === "text" && (column.name.toLowerCase().includes("item") || column.name.toLowerCase().includes("desc") || column.name.toLowerCase().includes("product")) ? (
                          <ItemSearch
                            value={null}
                            inputValue={String(row[column.id] || "")}
                            onInputChange={(value) => updateCell(rowIndex, column.id, value)}
                            onChange={(item) => {
                              if (item) {
                                setRows((currentRows) => {
                                  const nextRows = [...currentRows];
                                  const newRow = { ...nextRows[rowIndex] };
                                  newRow[column.id] = item.name;
                                  if (selectedTemplate) {
                                    // 1. Rate Mapping
                                    const rateCol = selectedTemplate.columns.find(c =>
                                      c.id === "col_rate" ||
                                      (c.type === "number" && (c.name.toLowerCase() === "rate" || c.name.toLowerCase() === "price" || c.name.toLowerCase().includes("rate")))
                                    );
                                    if (rateCol && item.rate != null) {
                                      newRow[rateCol.id] = item.rate;
                                    }

                                    // 2. Tax % Mapping
                                    const taxCol = selectedTemplate.columns.find(c =>
                                      c.id === "col_tax_percent" ||
                                      (c.type === "number" && (c.name.toLowerCase().includes("tax %") || c.name.toLowerCase().includes("gst %") || c.name.toLowerCase() === "tax percent"))
                                    );
                                    if (taxCol && item.taxRate != null) {
                                      newRow[taxCol.id] = item.taxRate;
                                    }

                                    // 3. HSN Code Mapping
                                    const hsnCol = selectedTemplate.columns.find(c =>
                                      c.id === "col_hsn" ||
                                      (c.type === "text" && (c.name.toLowerCase().includes("hsn") || c.name.toLowerCase().includes("sac")))
                                    );
                                    if (hsnCol && item.hsnCode) {
                                      newRow[hsnCol.id] = item.hsnCode;
                                    }

                                    nextRows[rowIndex] = evaluateRow(newRow, selectedTemplate.columns);
                                  } else {
                                    nextRows[rowIndex] = newRow;
                                  }
                                  return nextRows;
                                });
                              } else {
                                updateCell(rowIndex, column.id, "");
                              }
                            }}
                            className="min-w-[200px]"
                            placeholder={column.name}
                          />
                        ) : column.type === "number" ? (
                          <Input
                            type="number"
                            aria-label={`Row ${rowIndex + 1} ${column.name}`}
                            value={String(row[column.id] || "")}
                            onValueChange={(value) => updateCell(rowIndex, column.id, value)}
                            variant="underlined"
                            size="sm"
                            className="min-w-[80px]"
                          />
                        ) : column.type === "dropdown" && column.options ? (
                          <Select
                            aria-label={`Row ${rowIndex + 1} ${column.name}`}
                            placeholder={column.name}
                            selectedKeys={row[column.id] ? new Set([String(row[column.id])]) : new Set([])}
                            onSelectionChange={(keys) => {
                              const value = Array.from(keys)[0] as string;
                              if (value) {
                                updateCell(rowIndex, column.id, value);
                              }
                            }}
                            variant="underlined"
                            size="sm"
                            className="min-w-[120px]"
                          >
                            {column.options.map((option) => (
                              <SelectItem key={option}>{option}</SelectItem>
                            ))}
                          </Select>
                        ) : column.type === "date" ? (
                          <Input
                            type="date"
                            aria-label={`Row ${rowIndex + 1} ${column.name}`}
                            value={String(row[column.id] || "")}
                            onValueChange={(value) => updateCell(rowIndex, column.id, value)}
                            variant="underlined"
                            size="sm"
                            className="min-w-[130px]"
                          />
                        ) : (
                          <Input
                            type="text"
                            aria-label={`Row ${rowIndex + 1} ${column.name}`}
                            value={String(row[column.id] || "")}
                            onValueChange={(value) => updateCell(rowIndex, column.id, value)}
                            variant="underlined"
                            size="sm"
                            className="min-w-[120px]"
                          />
                        )}
                      </td>
                    ))}
                    <td className="px-2 py-2">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                        aria-label={`Remove row ${rowIndex + 1}`}
                        onPress={() => removeRow(rowIndex)}
                        isDisabled={rows.length <= 1}
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            d="M6 18L18 6M6 6l12 12"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                          />
                        </svg>
                      </Button>
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
              <Textarea
                label="Notes"
                placeholder="Additional notes..."
                value={notes}
                onValueChange={setNotes}
                variant="bordered"
                minRows={2}
              />
              <Textarea
                label="Terms & Conditions"
                placeholder="Enter terms..."
                value={terms}
                onValueChange={setTerms}
                variant="bordered"
                minRows={3}
              />
              {/* Ship To */}
              <div>
                <Checkbox
                  size="sm"
                  isSelected={showShipTo}
                  onValueChange={setShowShipTo}
                >
                  <span className="text-sm">Ship to a different address</span>
                </Checkbox>
                {showShipTo && (
                  <Textarea
                    label="Shipping Address"
                    placeholder="Enter shipping address..."
                    value={shippingAddress}
                    onValueChange={setShippingAddress}
                    variant="bordered"
                    minRows={2}
                    className="mt-2"
                  />
                )}
              </div>
            </CardBody>
          </Card>

          <Card shadow="sm" className="bg-gradient-to-br from-blue-500/5 to-indigo-500/5">
            <CardBody className="p-6">
              <h3 className="mb-4 text-lg font-semibold">Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-default-500">Subtotal</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-default-500">Total Tax</span>
                  </div>
                  <span className="font-medium">{formatCurrency(taxAmount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-default-400">{t("bills.autoTaxNote")}</p>
                  {(() => {
                    const partyState = extractGstinStateCode(gstin);
                    const tenantState = extractGstinStateCode(tenantGstin);
                    const isAutoDetected = !!(partyState && tenantState);
                    return (
                      <div className="flex flex-col items-end gap-0.5">
                        <label className={`flex items-center gap-1.5 select-none ${isAutoDetected ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}>
                          <input
                            type="checkbox"
                            checked={isInterState}
                            onChange={(e) => setIsInterState(e.target.checked)}
                            className="accent-primary"
                            disabled={isAutoDetected}
                          />
                          <span className="text-xs text-default-500">Inter-state (IGST)</span>
                        </label>
                        {isAutoDetected && (
                          <span className="text-[10px] text-default-400">Auto-detected from GST Numbers</span>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <Divider />
                {/* Round-off toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      size="sm"
                      isSelected={enableRoundOff}
                      onValueChange={setEnableRoundOff}
                      isDisabled={grandTotal === 0}
                    >
                      <span className="text-sm">Round off to nearest ₹</span>
                    </Checkbox>
                    {enableRoundOff && roundOff !== 0 && (
                      <span className={`text-sm font-mono ${roundOff > 0 ? 'text-success' : 'text-danger'}`}>
                        {roundOff > 0 ? '+' : ''}{formatCurrency(roundOff)}
                      </span>
                    )}
                  </div>
                </div>
                <Divider />
                <div className="flex justify-between">
                  <span className="text-lg font-bold">Grand Total</span>
                  <span className="text-lg font-bold text-primary">
                    {formatCurrency(roundedGrandTotal)}
                  </span>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="flat" onPress={() => router.push(`/bills/${id}`)}>
            Cancel
          </Button>
          <Button variant="bordered" onPress={() => handleSave("DRAFT")} isLoading={savingAs === "DRAFT"} isDisabled={savingAs === "FINAL"}>
            {t("bills.saveDraft")}
          </Button>
          <Button
            color="primary"
            className="bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold"
            onPress={() => handleSave("FINAL")}
            isLoading={savingAs === "FINAL"}
            isDisabled={savingAs === "DRAFT"}
          >
            Finalize Update
          </Button>
        </div>
      </div>
    </>
  );
}
