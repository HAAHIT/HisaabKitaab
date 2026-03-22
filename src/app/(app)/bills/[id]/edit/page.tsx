"use client";

import { useState, useEffect, useCallback, useMemo, use } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Input,
  Button,
  Select,
  SelectItem,
  Textarea,
  Divider,
  Chip,
} from "@heroui/react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  evaluateRow,
  type ColumnDef,
} from "@/lib/formula";

interface Template {
  id: string;
  name: string;
  columns: ColumnDef[];
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
}

function formatColumnValue(colName: string, value: number): string {
  const lower = colName.toLowerCase();
  const isCurrency =
    lower.includes("rate") ||
    lower.includes("price") ||
    lower.includes("amount") ||
    lower.includes("total") ||
    lower.includes("₹") ||
    lower.includes("rs");

  if (isCurrency) return formatCurrency(value);
  
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(value);
}

export default function EditBillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { t } = useLanguage();
  
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [expectedTemplateId, setExpectedTemplateId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Customer fields
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [gstin, setGstin] = useState("");

  const [rows, setRows] = useState<Record<string, string | number>[]>([]);

  const [taxPercent, setTaxPercent] = useState(18);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/templates");
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch {
      showToast("Failed to load templates", "error");
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Load existing bill data
  useEffect(() => {
    fetch(`/api/bills/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Bill not found");
        return res.json();
      })
      .then((data) => {
        if (data.bill) {
          const b = data.bill;
          setCustomerName(b.customerName);
          setCustomerPhone(b.customerPhone || "");
          setCustomerAddress(b.customerAddress || "");
          setGstin(b.gstin || "");
          setRows(Array.isArray(b.rows) ? b.rows : JSON.parse(b.rows as string || "[]"));
          setNotes(b.notes || "");
          setTerms(b.terms || "");
          setTaxPercent(b.taxPercent);
          setExpectedTemplateId(b.templateId);
        }
      })
      .catch((err) => {
        showToast(err.message, "error");
        setTimeout(() => router.push("/bills"), 1500);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, router]);

  // Auto-select template once loaded
  useEffect(() => {
    if (templates.length > 0 && expectedTemplateId && !selectedTemplate) {
      const tmpl = templates.find((t) => t.id === expectedTemplateId);
      if (tmpl) setSelectedTemplate(tmpl);
    }
  }, [templates, expectedTemplateId, selectedTemplate]);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  function addRow() {
    if (!selectedTemplate) return;
    const emptyRow: Record<string, string | number> = {};
    (selectedTemplate.columns as ColumnDef[]).forEach((col) => {
      emptyRow[col.id] = col.type === "number" || col.type === "formula" ? 0 : "";
    });
    setRows([...rows, emptyRow]);
  }

  function removeRow(index: number) {
    if (rows.length <= 1) return;
    setRows(rows.filter((_, i) => i !== index));
  }

  function updateCell(rowIndex: number, colId: string, value: string) {
    const newRows = [...rows];
    const col = (selectedTemplate?.columns as ColumnDef[])?.find(
      (c) => c.id === colId
    );
    if (col?.type === "number") {
      newRows[rowIndex][colId] = value === "" ? 0 : parseFloat(value) || 0;
    } else {
      newRows[rowIndex][colId] = value;
    }
    if (selectedTemplate) {
      newRows[rowIndex] = evaluateRow(
        newRows[rowIndex],
        selectedTemplate.columns as ColumnDef[]
      );
    }
    setRows(newRows);
  }

  const { subtotal, taxAmount, grandTotal } = useMemo(() => {
    if (!selectedTemplate) return { subtotal: 0, taxAmount: 0, grandTotal: 0 };
    const cols = selectedTemplate.columns as ColumnDef[];
    const lastCol = [...cols].reverse().find(
      (c) => c.type === "formula" || c.type === "number"
    );
    if (!lastCol) return { subtotal: 0, taxAmount: 0, grandTotal: 0 };

    const subtotal = rows.reduce((sum, row) => {
      const val = typeof row[lastCol.id] === "number" ? row[lastCol.id] as number : 0;
      return sum + val;
    }, 0);

    const taxAmount = Math.round((subtotal * taxPercent) / 100 * 100) / 100;
    const grandTotal = Math.round((subtotal + taxAmount) * 100) / 100;

    return { subtotal, taxAmount, grandTotal };
  }, [rows, taxPercent, selectedTemplate]);

  async function handleSave(status: "DRAFT" | "FINALIZED") {
    const mainScroll = document.querySelector('main');
    if (!selectedTemplate) {
      showToast("Please wait for template to load", "error");
      mainScroll?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // Validation
    const formErrors: Record<string, boolean> = {};
    if (!customerName.trim()) formErrors.customerName = true;

    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      showToast("Please fill in required fields", "error");
      mainScroll?.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(() => setErrors({}), 3000); // Clear aggressive blink after 3s
      return;
    }
    setErrors({});

    setSaving(true);
    try {
      const res = await fetch(`/api/bills/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerPhone,
          customerAddress,
          gstin,
          rows,
          notes,
          terms,
          taxPercent,
          subtotal,
          taxAmount,
          grandTotal,
          status,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to edit bill");

      showToast(
        `Bill updated and ${status === "DRAFT" ? "saved as draft" : "finalized"}!`,
        "success"
      );
      setTimeout(() => router.push("/bills"), 800);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to update bill",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-default-500">Loading bill data...</div>;
  }

  return (
    <>
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg animate-slide-up ${
            toast.type === "success"
              ? "bg-success text-white"
              : "bg-danger text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="p-4 lg:p-8 animate-fade-in">
        {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button isIconOnly variant="light" onPress={() => router.push("/bills")}>
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Edit Bill</h1>
          <p className="text-default-500 text-sm mt-1">
            Update bill details
          </p>
        </div>
      </div>

      {/* Bill Form — only when template selected */}
      {selectedTemplate && (
        <>
          {/* Template badge */}
          <div className="flex items-center gap-2 mb-4">
            <Chip size="sm" color="primary" variant="flat">
              📋 {selectedTemplate.name}
            </Chip>
          </div>

          {/* Customer Details */}
          <Card shadow="sm" className="mb-6">
            <CardHeader className="px-6 pt-6 pb-0">
              <h2 className="text-lg font-semibold">Customer Details</h2>
            </CardHeader>
            <CardBody className="p-6">
              <div className="grid md:grid-cols-2 gap-4">
                <Input
                  label={t("bills.customer")}
                  placeholder="Enter customer name"
                  value={customerName}
                  onValueChange={(val) => {
                    setCustomerName(val);
                    if (val.trim()) setErrors((e) => ({ ...e, customerName: false }));
                  }}
                  variant="bordered"
                  isRequired
                  isInvalid={!!errors.customerName}
                  errorMessage={errors.customerName ? "Customer name is required" : undefined}
                  classNames={{
                    inputWrapper: errors.customerName ? "animate-pulse bg-danger/10 border-danger" : "",
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
                  placeholder="Customer address"
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

          {/* Items Table */}
          <Card shadow="sm" className="mb-6">
            <CardHeader className="px-6 pt-6 pb-0 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Line Items</h2>
              <Button
                size="sm"
                variant="flat"
                color="primary"
                onPress={addRow}
                startContent={
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                }
              >
                Add Row
              </Button>
            </CardHeader>
            <CardBody className="p-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-divider">
                    <th className="text-left py-3 px-2 text-default-500 font-medium w-10">
                      #
                    </th>
                    {(selectedTemplate.columns as ColumnDef[]).map((col) => (
                      <th
                        key={col.name}
                        className="text-left py-3 px-2 text-default-500 font-medium"
                      >
                        <div className="flex items-center gap-1">
                          {col.name}
                          {col.type === "formula" && (
                            <span className="text-warning text-xs">ƒx</span>
                          )}
                        </div>
                      </th>
                    ))}
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className="border-b border-divider/30 hover:bg-default-50 dark:hover:bg-default-100/5"
                    >
                      <td className="py-2 px-2 text-default-400">{rowIndex + 1}</td>
                      {(selectedTemplate.columns as ColumnDef[]).map((col) => (
                        <td key={col.id} className="py-2 px-2">
                          {col.type === "formula" ? (
                            <span className="font-mono text-success font-medium">
                              {typeof row[col.id] === "number"
                                ? formatColumnValue(col.name, row[col.id] as number)
                                : "—"}
                            </span>
                          ) : col.type === "number" ? (
                            <Input
                              type="number"
                              value={String(row[col.id] || "")}
                              onValueChange={(v) =>
                                updateCell(rowIndex, col.id, v)
                              }
                              variant="underlined"
                              size="sm"
                              className="min-w-[80px]"
                            />
                          ) : col.type === "dropdown" && col.options ? (
                            <Select
                              selectedKeys={
                                row[col.id] ? [String(row[col.id])] : []
                              }
                              onSelectionChange={(keys) => {
                                const val = Array.from(keys)[0] as string;
                                if (val) updateCell(rowIndex, col.id, val);
                              }}
                              variant="underlined"
                              size="sm"
                              className="min-w-[120px]"
                            >
                              {col.options.map((opt) => (
                                <SelectItem key={opt}>{opt}</SelectItem>
                              ))}
                            </Select>
                          ) : col.type === "date" ? (
                            <Input
                              type="date"
                              value={String(row[col.id] || "")}
                              onValueChange={(v) =>
                                updateCell(rowIndex, col.id, v)
                              }
                              variant="underlined"
                              size="sm"
                              className="min-w-[130px]"
                            />
                          ) : (
                            <Input
                              type="text"
                              value={String(row[col.id] || "")}
                              onValueChange={(v) =>
                                updateCell(rowIndex, col.id, v)
                              }
                              variant="underlined"
                              size="sm"
                              className="min-w-[120px]"
                            />
                          )}
                        </td>
                      ))}
                      <td className="py-2 px-2">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          color="danger"
                          onPress={() => removeRow(rowIndex)}
                          isDisabled={rows.length <= 1}
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M6 18L18 6M6 6l12 12"
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

          {/* Totals + Notes */}
          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            {/* Notes & Terms */}
            <Card shadow="sm">
              <CardBody className="p-6 space-y-4">
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

            {/* Totals */}
            <Card
              shadow="sm"
              className="bg-gradient-to-br from-blue-500/5 to-indigo-500/5"
            >
              <CardBody className="p-6">
                <h3 className="text-lg font-semibold mb-4">Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-default-500">Subtotal</span>
                    <span className="font-medium">
                      {formatCurrency(subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-default-500">Tax</span>
                      <Input
                        type="number"
                        value={String(taxPercent)}
                        onValueChange={(v) =>
                          setTaxPercent(parseFloat(v) || 0)
                        }
                        variant="bordered"
                        size="sm"
                        className="w-20"
                        endContent={
                          <span className="text-default-400 text-sm">%</span>
                        }
                      />
                    </div>
                    <span className="font-medium">
                      {formatCurrency(taxAmount)}
                    </span>
                  </div>
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

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button variant="flat" onPress={() => router.push("/bills")}>
              Cancel
            </Button>
            <Button
              variant="bordered"
              onPress={() => handleSave("DRAFT")}
              isLoading={saving}
            >
              💾 {t("bills.saveDraft")}
            </Button>
            <Button
              color="primary"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold"
              onPress={() => handleSave("FINALIZED")}
              isLoading={saving}
            >
              ✅ Finalize Update
            </Button>
          </div>
        </>
      )}
      </div>
    </>
  );
}
