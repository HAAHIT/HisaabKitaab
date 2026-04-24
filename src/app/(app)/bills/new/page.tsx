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
} from "@heroui/react";
import { useRouter, useSearchParams } from "next/navigation";
import { PartySearch, type PartyOption } from "@/components/ui/PartySearch";
import { ItemSearch } from "@/components/ui/ItemSearch";
import { StateSearch } from "@/components/ui/StateSearch";
import { useLanguage } from "@/contexts/LanguageContext";
import { evaluateRow, type ColumnDef } from "@/lib/formula";
import { GST_STATE_CODES } from "@/lib/gst-states";
import { extractGstinStateCode } from "@/lib/gst-helpers";

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

export default function NewBillPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingAs, setSavingAs] = useState<"DRAFT" | "FINAL" | null>(null);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const searchParams = useSearchParams();
  const preselectedPartyId = searchParams.get("partyId");
  const [selectedParty, setSelectedParty] = useState<PartyOption | null>(null);
  const [rows, setRows] = useState<Record<string, string | number>[]>([]);
  const [isInterState, setIsInterState] = useState(false);
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [didAutoFocusRow, setDidAutoFocusRow] = useState(false);
  const [tenantGstin, setTenantGstin] = useState<string | null>(null);
  const [billDate, setBillDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [enableRoundOff, setEnableRoundOff] = useState(false);
  const [shippingAddress, setShippingAddress] = useState("");
  const [showShipTo, setShowShipTo] = useState(false);

  const fetchFormData = useCallback(async () => {
    setLoading(true);
    try {
      const [templatesResponse, settingsResponse] = await Promise.all([
        fetch("/api/templates"),
        fetch("/api/settings"),
      ]);

      const [templatesData, settingsData] = await Promise.all([
        templatesResponse.json().catch(() => ({ templates: [] })),
        settingsResponse.json().catch(() => ({ settings: null })),
      ]);

      setTemplates(templatesData.templates || []);

      if (settingsData.settings) {
        setTerms(settingsData.settings.defaultTerms || "");
        setTenantGstin(settingsData.settings.companyGstin || null);
      }
    } catch {
      showToast("Failed to load bill form data", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFormData();
  }, [fetchFormData]);

  const [preselectedParty, setPreselectedParty] = useState<PartyOption | null>(null);

  useEffect(() => {
    if (!preselectedPartyId || selectedParty) return;
    fetch(`/api/parties/${preselectedPartyId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.party) {
          const p = data.party as PartyOption;
          setPreselectedParty(p);
          setSelectedParty(p);
        }
      })
      .catch(() => {/* silently ignore — user can search manually */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedPartyId]);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }

  const selectTemplate = useCallback((templateId: string) => {
    const template = templates.find((item) => item.id === templateId);
    if (!template) {
      return;
    }

    setSelectedTemplate(template);
    setRows([buildEmptyRow(template)]);
  }, [templates]);

  useEffect(() => {
    if (templates.length === 1 && !selectedTemplate) {
      selectTemplate(templates[0].id);
    }
  }, [selectTemplate, selectedTemplate, templates]);

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
    // Clean to 2dp to avoid IEEE 754 noise (e.g. 0.2999999999992724 → 0.30)
    return Math.round((Math.round(grandTotal) - grandTotal) * 100) / 100;
  }, [enableRoundOff, grandTotal]);

  const roundedGrandTotal = useMemo(() => {
    return enableRoundOff ? Math.round(grandTotal) : grandTotal;
  }, [enableRoundOff, grandTotal]);

  const firstEditableColumnId = useMemo(() => {
    if (!selectedTemplate) {
      return null;
    }

    return (
      selectedTemplate.columns.find((column) => column.type !== "formula")?.id ?? null
    );
  }, [selectedTemplate]);

  useEffect(() => {
    setDidAutoFocusRow(false);
  }, [selectedParty?.id, selectedTemplate?.id]);

  useEffect(() => {
    if (!selectedParty || !selectedTemplate || rows.length === 0 || didAutoFocusRow) {
      return;
    }

    const focusTimer = window.setTimeout(() => {
      const target = document.querySelector<
        HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement
      >(
        '[data-bill-focus-target="true"] input, [data-bill-focus-target="true"] textarea, [data-bill-focus-target="true"] button'
      );

      target?.focus();
      setDidAutoFocusRow(true);
    }, 0);

    return () => window.clearTimeout(focusTimer);
  }, [didAutoFocusRow, rows.length, selectedParty, selectedTemplate]);

  async function handleSave(status: "DRAFT" | "FINAL") {
    const mainScroll = document.querySelector("main");

    if (!selectedTemplate) {
      showToast("Please select a template", "error");
      mainScroll?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const formErrors: Record<string, boolean> = {};
    if (!selectedParty) {
      formErrors.partyId = true;
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

    const currentParty = selectedParty;
    if (!currentParty) {
      showToast("Please select a party", "error");
      return;
    }

    setErrors({});
    setSavingAs(status);

    try {
      const response = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          partyId: currentParty.id,
          customerName: currentParty.name,
          customerPhone: currentParty.phone || null,
          customerAddress: currentParty.address || null,
          gstin: currentParty.gstin || null,
          rows,
          subtotal,
          taxPercent: 0,
          taxAmount,
          grandTotal: roundedGrandTotal,
          roundOff,
          isInterState,
          placeOfSupply: placeOfSupply || null,
          hsnCode: null,
          shippingAddress: showShipTo && shippingAddress.trim() ? shippingAddress.trim() : null,
          notes: notes.trim() || null,
          terms: terms.trim() || null,
          status,
          date: billDate,
        }),
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const data = await response.json();
      showToast(status === "FINAL" ? "Bill created" : "Draft saved", "success");
      window.setTimeout(() => router.push(`/bills/${data.bill.id}`), 700);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to save bill", "error");
    } finally {
      setSavingAs(null);
    }
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
            aria-label="Back to bills"
            onPress={() => router.push("/bills")}
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
            <h1 className="text-2xl font-bold">{t("bills.new")}</h1>
            <p className="mt-1 text-sm text-default-500">
              Choose a real party record first, then confirm the invoice snapshot.
            </p>
          </div>
        </div>

        {!selectedTemplate && (
          <Card shadow="sm" className="mb-6">
            <CardBody className="p-6">
              <h2 className="mb-4 text-lg font-semibold">Choose Template</h2>
              {loading ? (
                <p className="text-default-400">Loading templates...</p>
              ) : templates.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-default-500">No templates found</p>
                  <Button
                    size="sm"
                    variant="flat"
                    color="primary"
                    className="mt-2"
                    onPress={() => router.push("/settings/templates/new")}
                  >
                    Create Template First
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => selectTemplate(template.id)}
                      className="group relative w-full rounded-2xl border border-default-200 bg-content1 p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-primary-300/60 hover:bg-primary-500/[0.04] hover:shadow-[0_12px_28px_-20px_rgba(59,130,246,0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <div className="flex items-start gap-3">
                        <div className="rounded-xl bg-primary-100 p-3 text-primary transition-colors group-hover:bg-primary group-hover:text-white group-hover:shadow-lg group-hover:shadow-primary/30 dark:bg-primary/15 dark:text-primary-300">
                          <svg
                            aria-hidden="true"
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              d="M9 12h6m-6 4h6M8 4h8a2 2 0 012 2v12a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2z"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.8}
                            />
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-semibold text-default-900 dark:text-default-100">
                            {template.name}
                          </p>
                          <p className="mt-1 text-xs text-default-500">
                            {template.columns.length} column{template.columns.length === 1 ? "" : "s"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {template.columns.map((column) => (
                          <Chip
                            key={column.id}
                            size="sm"
                            variant="flat"
                            color={
                              column.type === "formula"
                                ? "warning"
                                : column.type === "number"
                                  ? "primary"
                                  : "default"
                            }
                          >
                            {column.name}
                          </Chip>
                        ))}
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
              <Chip size="sm" color="primary" variant="flat">
                {selectedTemplate.name}
              </Chip>
              <Button
                size="sm"
                variant="light"
                onPress={() => {
                  setSelectedTemplate(null);
                  setRows([]);
                }}
              >
                Change Template
              </Button>
            </div>

            <Card shadow="sm" className="mb-6">
              <CardHeader className="px-6 pt-6 pb-0 flex justify-between items-center">
                <h2 className="text-lg font-semibold">{t("bills.billTo")}</h2>
                <Input
                  type="date"
                  aria-label="Bill Date"
                  size="sm"
                  variant="flat"
                  value={billDate}
                  onValueChange={setBillDate}
                  className="w-40"
                  startContent={<span className="text-default-400 text-sm mr-1">Date:</span>}
                />
              </CardHeader>
              <CardBody className="p-6">
                <PartySearch
                  value={selectedParty?.id || null}
                  onChange={(party) => {
                    setSelectedParty(party);
                    if (party) {
                      setErrors((prev) => ({ ...prev, partyId: false }));
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
                    }
                  }}
                  partyType="CUSTOMER"
                  placeholder={t("bills.selectCustomer")}
                  autoFocus={!selectedParty}
                  isInvalid={Boolean(errors.partyId)}
                  initialParty={preselectedParty}
                />

                {selectedParty && (
                  <div className="mt-4 rounded-xl bg-default-50 dark:bg-default-100/5 p-4 border border-default-200 animate-slide-up">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-lg">{selectedParty.name}</h3>
                      <Button
                        size="sm"
                        variant="light"
                        onPress={() => setSelectedParty(null)}
                      >
                        {t("common.change")}
                      </Button>
                    </div>

                    <div className="space-y-1 text-sm text-default-500">
                      {selectedParty.phone && (
                        <p className="flex items-center gap-2">
                          <span>📱</span> {selectedParty.phone}
                        </p>
                      )}
                      {selectedParty.address && (
                        <p className="flex items-center gap-2">
                          <span>📍</span> {selectedParty.address}
                        </p>
                      )}
                      {selectedParty.gstin && (
                        <p className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold tracking-widest text-default-400">GST</span> {selectedParty.gstin}
                        </p>
                      )}
                    </div>

                    {selectedParty.currentBalance !== 0 && (
                      <div className={`mt-3 pt-3 border-t border-default-200 text-sm font-medium flex items-center gap-2 ${selectedParty.currentBalance < 0 ? "text-success" : "text-danger"
                        }`}>
                        <div className={`w-2 h-2 rounded-full ${selectedParty.currentBalance < 0 ? "bg-success" : "bg-danger"}`} />
                        {selectedParty.currentBalance < 0
                          ? `To Get: ₹${Math.abs(selectedParty.currentBalance).toLocaleString("en-IN")}`
                          : `To Pay: ₹${selectedParty.currentBalance.toLocaleString("en-IN")}`
                        }
                      </div>
                    )}
                  </div>
                )}
              </CardBody>
            </Card>

            <Card shadow="sm" className="mb-6">
              <CardHeader className="flex items-center justify-between px-6 pt-6 pb-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-lg font-semibold">Line Items</h2>
                  <Chip size="sm" variant="flat" color="default">
                    Subtotal {formatCurrency(subtotal)}
                  </Chip>
                  <Chip size="sm" variant="flat" color="primary">
                    Total {formatCurrency(grandTotal)}
                  </Chip>
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
                          <td
                            key={column.id}
                            className="px-2 py-2"
                            data-bill-focus-target={
                              rowIndex === 0 && column.id === firstEditableColumnId
                                ? "true"
                                : undefined
                            }
                          >
                            {column.type === "formula" ? (
                              <span className="font-mono font-medium text-success">
                                {typeof row[column.id] === "number"
                                  ? formatColumnValue(column.name, row[column.id] as number)
                                  : "-"}
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
                                  <SelectItem key={option} textValue={option}>{option}</SelectItem>

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
                  {/* Ship To Address */}
                  <div>
                    <label className="flex items-center gap-1.5 select-none cursor-pointer mb-2">
                      <input
                        type="checkbox"
                        checked={showShipTo}
                        onChange={(e) => setShowShipTo(e.target.checked)}
                        className="accent-primary"
                      />
                      <span className="text-sm text-default-600">Ship to a different address</span>
                    </label>
                    {showShipTo && (
                      <Textarea
                        label="Shipping Address"
                        placeholder="Enter shipping / delivery address..."
                        value={shippingAddress}
                        onValueChange={setShippingAddress}
                        variant="bordered"
                        minRows={2}
                        className="animate-slide-up"
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
                        const isAutoDetected = !!selectedParty?.gstin;
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
                    <div className="flex items-center justify-between gap-3">
                      <span className="shrink-0 text-sm text-default-500">Place of Supply</span>
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
                        className="max-w-[200px]"
                      />
                    </div>
                    <Divider />
                    {/* Round-Off Toggle */}
                    <div className="flex items-center justify-between">
                      <label className={`flex items-center gap-1.5 select-none ${grandTotal === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={enableRoundOff}
                          onChange={(e) => setEnableRoundOff(e.target.checked)}
                          className="accent-primary"
                          disabled={grandTotal === 0}
                        />
                        <span className="text-xs text-default-500">Round off to nearest ₹</span>
                      </label>
                      {enableRoundOff && roundOff !== 0 && (
                        <span className={`text-sm font-mono ${roundOff > 0 ? 'text-success' : 'text-danger'}`}>
                          {roundOff > 0 ? '+' : ''}{formatCurrency(roundOff)}
                        </span>
                      )}
                    </div>
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
              <Button variant="flat" onPress={() => router.push("/bills")}>
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
                {t("bills.finalize")}
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
