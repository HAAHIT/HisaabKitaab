"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
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
} from "@heroui/react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { evaluateRow, type ColumnDef } from "@/lib/formula";
import { GST_STATE_CODES } from "@/lib/gst-states";

interface Template {
  id: string;
  name: string;
  columns: ColumnDef[];
}

interface PartyOption {
  id: string;
  name: string;
  type: "CUSTOMER" | "VENDOR";
  phone: string | null;
  address: string | null;
  gstin: string | null;
}

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

  const [parties, setParties] = useState<PartyOption[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [bill, setBill] = useState<BillResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingAs, setSavingAs] = useState<"DRAFT" | "FINAL" | null>(null);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const [partyId, setPartyId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [gstin, setGstin] = useState("");
  const [rows, setRows] = useState<Record<string, string | number>[]>([]);
  const [taxPercent, setTaxPercent] = useState(18);
  const [isInterState, setIsInterState] = useState(false);
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [hsnCode, setHsnCode] = useState("");
  const [hsnPerRow, setHsnPerRow] = useState(false);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");

  const fetchFormData = useCallback(async () => {
    setLoading(true);
    try {
      const [billResponse, templatesResponse, partiesResponse] = await Promise.all([
        fetch(`/api/bills/${id}`),
        fetch("/api/templates"),
        fetch("/api/parties"),
      ]);

      if (!billResponse.ok) {
        throw new Error(await readError(billResponse));
      }

      const [billData, templatesData, partiesData] = await Promise.all([
        billResponse.json(),
        templatesResponse.json().catch(() => ({ templates: [] })),
        partiesResponse.json().catch(() => ({ parties: [] })),
      ]);

      const nextBill = billData.bill as BillResponse;
      const nextTemplates = (templatesData.templates || []) as Template[];
      const nextParties = (partiesData.parties || []) as PartyOption[];

      setBill(nextBill);
      setParties(nextParties);
      setPartyId(nextBill.partyId || "");
      setCustomerName(nextBill.customerName);
      setCustomerPhone(nextBill.customerPhone || "");
      setCustomerAddress(nextBill.customerAddress || "");
      setGstin(nextBill.gstin || "");
      const loadedRows = Array.isArray(nextBill.rows) ? nextBill.rows : [];
      setRows(loadedRows);
      // Auto-enable per-row HSN mode if any existing row already has _hsnCode
      const hasRowHsn = loadedRows.some(
        (r) => typeof r._hsnCode === "string" && (r._hsnCode as string).trim()
      );
      if (hasRowHsn) setHsnPerRow(true);
      setNotes(nextBill.notes || "");
      setTerms(nextBill.terms || "");
      setTaxPercent(nextBill.taxPercent);
      setHsnCode(nextBill.hsnCode || "");
      setIsInterState(nextBill.isInterState === true);
      setPlaceOfSupply(nextBill.placeOfSupply || "");

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

  function applyPartySnapshot(nextPartyId: string) {
    setPartyId(nextPartyId);
    const party = parties.find((item) => item.id === nextPartyId);
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

  function updateRowHsn(rowIndex: number, value: string) {
    setRows((currentRows) => {
      const nextRows = [...currentRows];
      nextRows[rowIndex] = { ...nextRows[rowIndex], _hsnCode: value };
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

    const nextSubtotal = rows.reduce((sum, row) => {
      const value =
        typeof row[lastValueColumn.id] === "number"
          ? (row[lastValueColumn.id] as number)
          : 0;
      return sum + value;
    }, 0);

    const nextTaxAmount = Math.round(((nextSubtotal * taxPercent) / 100) * 100) / 100;
    const nextGrandTotal = Math.round((nextSubtotal + nextTaxAmount) * 100) / 100;

    return {
      subtotal: nextSubtotal,
      taxAmount: nextTaxAmount,
      grandTotal: nextGrandTotal,
    };
  }, [rows, selectedTemplate, taxPercent]);

  async function handleSave(status: "DRAFT" | "FINAL") {
    const mainScroll = document.querySelector("main");

    if (!selectedTemplate || !bill) {
      showToast("Please wait for bill data to load", "error");
      mainScroll?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const formErrors: Record<string, boolean> = {};
    if (!partyId) {
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
          partyId,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim() || null,
          customerAddress: customerAddress.trim() || null,
          gstin: gstin.trim() || null,
          rows,
          notes: notes.trim() || null,
          terms: terms.trim() || null,
          taxPercent,
          subtotal,
          taxAmount,
          grandTotal,
          isInterState,
          hsnCode: hsnCode.trim() || null,
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
          className={`fixed right-4 top-4 z-[100] rounded-xl px-4 py-3 shadow-lg animate-slide-up ${
            toast.type === "success" ? "bg-success text-white" : "bg-danger text-white"
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
            <Select
              label="Party"
              placeholder="Select customer or vendor"
              selectedKeys={partyId ? new Set([partyId]) : new Set([])}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0] as string;
                if (value) {
                  applyPartySnapshot(value);
                }
              }}
              variant="bordered"
              isLoading={loading}
              isInvalid={Boolean(errors.partyId)}
              errorMessage={errors.partyId ? "Party is required" : undefined}
            >
              {parties.map((party) => (
                <SelectItem key={party.id} textValue={party.name}>
                  <div className="flex w-full items-center justify-between">
                    <span>{party.name}</span>
                    <span className="text-xs capitalize text-default-400">
                      {party.type.toLowerCase()}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </Select>

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
                onValueChange={setGstin}
                variant="bordered"
              />
            </div>
          </CardBody>
        </Card>

        <Card shadow="sm" className="mb-6">
          <CardHeader className="flex items-center justify-between px-6 pt-6 pb-0">
            <div className="flex gap-4 items-center">
              <h2 className="text-lg font-semibold">Line Items</h2>
              <Select
                aria-label="Place of supply"
                placeholder="Place of Supply (State)"
                size="sm"
                variant="bordered"
                className="w-[200px]"
                selectedKeys={placeOfSupply ? new Set([placeOfSupply]) : new Set([])}
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0] as string | undefined;
                  setPlaceOfSupply(value ?? "");
                  if (value) {
                    setErrors((curr) => ({ ...curr, placeOfSupply: false }));
                  }
                }}
                isInvalid={Boolean(errors.placeOfSupply)}
                errorMessage={errors.placeOfSupply ? "Required for final bills" : undefined}
              >
                {Object.entries(GST_STATE_CODES).map(([code, name]) => (
                  <SelectItem key={code} textValue={`${code} - ${name}`}>
                    {code} — {name}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <div className="flex items-center gap-2">
              {taxPercent > 0 && (
                <Button
                  size="sm"
                  variant={hsnPerRow ? "flat" : "light"}
                  color={hsnPerRow ? "secondary" : "default"}
                  onPress={() => setHsnPerRow((v) => !v)}
                  title="Add HSN/SAC code per line item for GSTR-1 Table 12"
                >
                  HSN per row
                </Button>
              )}
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
            </div>
          </CardHeader>
          <CardBody className="overflow-x-auto p-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-divider">
                  <th className="w-10 px-2 py-3 text-left font-medium text-default-500">#</th>
                  {hsnPerRow && taxPercent > 0 && (
                    <th className="px-2 py-3 text-left font-medium text-default-500 text-xs whitespace-nowrap">
                      HSN/SAC
                    </th>
                  )}
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
                    {hsnPerRow && taxPercent > 0 && (
                      <td className="px-2 py-2">
                        <Input
                          type="text"
                          aria-label={`Row ${rowIndex + 1} HSN/SAC code`}
                          placeholder="e.g. 9983"
                          value={String(row._hsnCode || "")}
                          onValueChange={(value) => updateRowHsn(rowIndex, value)}
                          variant="underlined"
                          size="sm"
                          className="min-w-[80px] max-w-[100px]"
                        />
                      </td>
                    )}
                    {selectedTemplate.columns.map((column) => (
                      <td key={column.id} className="px-2 py-2">
                        {column.type === "formula" ? (
                          <span className="font-mono font-medium text-success">
                            {typeof row[column.id] === "number"
                              ? formatColumnValue(column.name, row[column.id] as number)
                              : "-"}
                          </span>
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
                    <span className="text-default-500">Tax</span>
                    <Input
                      type="number"
                      aria-label="Tax percentage"
                      value={String(taxPercent)}
                      onValueChange={(value) => setTaxPercent(Number.parseFloat(value) || 0)}
                      variant="bordered"
                      size="sm"
                      className="w-20"
                      endContent={<span className="text-sm text-default-400">%</span>}
                    />
                  </div>
                  <span className="font-medium">{formatCurrency(taxAmount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-default-400">{t("bills.autoTaxNote")}</p>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isInterState}
                      onChange={(e) => setIsInterState(e.target.checked)}
                      className="accent-primary"
                    />
                    <span className="text-xs text-default-500">Inter-state (IGST)</span>
                  </label>
                </div>
                {!hsnPerRow && (
                <div className="flex items-center justify-between gap-3">
                  <span className="shrink-0 text-sm text-default-500">HSN/SAC Code</span>
                  <Input
                    aria-label="HSN/SAC Code"
                    placeholder="e.g. 9983"
                    size="sm"
                    variant="bordered"
                    value={hsnCode}
                    onValueChange={setHsnCode}
                    className="max-w-[200px]"
                  />
                </div>
                )}
                {hsnPerRow && taxPercent > 0 && (
                  <p className="text-xs text-default-400">
                    HSN/SAC entered per row above (GSTR-1 Table 12)
                  </p>
                )}
                <Divider />
                <div className="flex justify-between">
                  <span className="text-lg font-bold">Grand Total</span>
                  <span className="text-lg font-bold text-primary">
                    {formatCurrency(grandTotal)}
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
