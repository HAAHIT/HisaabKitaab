"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { HKSelect, HKSelectItem } from "@/components/ui/HKSelect";
import { HKTextarea } from "@/components/ui/HKTextarea";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { evaluateRow, type ColumnDef } from "@/lib/formula";
import { GST_STATE_CODES } from "@/lib/gst-states";
import ItemCatalogPicker from "@/components/bills/ItemCatalogPicker";
import {
  GR, AM, OR, PU, SG, IN, TYPE, TOUCH,
  fmtFull,
  HKCard, HKToast, PageHeader, useIsMobile,
} from "@/components/ui/hk-design";
import { HKButton } from "@/components/ui/HKButton";
import { HKInput } from "@/components/ui/HKInput";

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
  grandTotal?: number;
  roundOff?: number | null;
  date?: string;
  hsnCode?: string | null;
}

function formatColumnValue(columnName: string, value: number) {
  const lower = columnName.toLowerCase();
  const isCurrency =
    lower.includes("rate") || lower.includes("price") ||
    lower.includes("amount") || lower.includes("total") || lower.includes("rs");
  if (isCurrency) return fmtFull(value);
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
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

function Section({ title, action, children }: { title?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <HKCard style={{ marginBottom: 16, padding: 0, overflow: "visible" }}>
      {(title || action) && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px 12px", borderBottom: "1px solid var(--hk-border)",
        }}>
          {title && <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--hk-text)", fontFamily: SG, margin: 0 }}>{title}</p>}
          {action}
        </div>
      )}
      <div style={{ padding: 20 }}>{children}</div>
    </HKCard>
  );
}

export default function EditBillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { t } = useLanguage();
  const isMobile = useIsMobile();

  const [parties, setParties] = useState<PartyOption[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [bill, setBill] = useState<BillResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingAs, setSavingAs] = useState<"DRAFT" | "FINAL" | null>(null);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

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
  const [enableRoundOff, setEnableRoundOff] = useState(false);
  const [billDate, setBillDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [showCatalogPicker, setShowCatalogPicker] = useState(false);
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

      if (!billResponse.ok) throw new Error(await readError(billResponse));

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
      if (nextBill.roundOff && nextBill.roundOff !== 0) setEnableRoundOff(true);
      if (nextBill.date) setBillDate(new Date(nextBill.date).toISOString().slice(0, 10));

      const template = nextTemplates.find((item) => item.id === nextBill.templateId) || null;
      setSelectedTemplate(template);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to load bill", "error");
      window.setTimeout(() => router.push("/bills"), 1200);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { fetchFormData(); }, [fetchFormData]);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }

  function applyPartySnapshot(nextPartyId: string) {
    setPartyId(nextPartyId);
    const party = parties.find((item) => item.id === nextPartyId);
    if (!party) return;
    setCustomerName(party.name);
    setCustomerPhone(party.phone || "");
    setCustomerAddress(party.address || "");
    setGstin(party.gstin || "");
    if (party.gstin && party.gstin.length >= 2) {
      const code = party.gstin.substring(0, 2);
      if (GST_STATE_CODES[code]) setPlaceOfSupply(code);
    }
    setErrors((curr) => ({ ...curr, partyId: false, customerName: false }));
  }

  function addRow() {
    if (!selectedTemplate) return;
    setRows((curr) => [...curr, buildEmptyRow(selectedTemplate)]);
  }

  function removeRow(index: number) {
    if (rows.length <= 1) return;
    setRows((curr) => curr.filter((_, i) => i !== index));
  }

  function updateCell(rowIndex: number, columnId: string, value: string) {
    setRows((curr) => {
      const next = [...curr];
      const column = selectedTemplate?.columns.find((c) => c.id === columnId);
      if (column?.type === "number") {
        next[rowIndex][columnId] = value === "" ? 0 : Number.parseFloat(value) || 0;
      } else {
        next[rowIndex][columnId] = value;
      }
      if (selectedTemplate) next[rowIndex] = evaluateRow(next[rowIndex], selectedTemplate.columns);
      return next;
    });
  }

  function updateRowHsn(rowIndex: number, value: string) {
    setRows((curr) => {
      const next = [...curr];
      next[rowIndex] = { ...next[rowIndex], _hsnCode: value };
      return next;
    });
  }

  function handleCatalogSelect(rowData: Record<string, string | number>, taxRate: number | null) {
    if (!selectedTemplate) return;
    const baseRow = buildEmptyRow(selectedTemplate);
    const merged = { ...baseRow, ...rowData };
    const evaluated = evaluateRow(merged, selectedTemplate.columns);
    setRows((prev) => [...prev, evaluated]);
    if (taxRate !== null) setTaxPercent(taxRate);
    if (rowData._hsnCode && String(rowData._hsnCode).trim()) setHsnPerRow(true);
    setShowCatalogPicker(false);
  }

  const { subtotal, taxAmount, grandTotal } = useMemo(() => {
    if (!selectedTemplate) return { subtotal: 0, taxAmount: 0, grandTotal: 0 };
    const lastValueColumn = [...selectedTemplate.columns]
      .reverse()
      .find((c) => c.type === "formula" || c.type === "number");
    if (!lastValueColumn) return { subtotal: 0, taxAmount: 0, grandTotal: 0 };
    const nextSubtotal = rows.reduce((sum, row) => {
      const value = typeof row[lastValueColumn.id] === "number" ? (row[lastValueColumn.id] as number) : 0;
      return sum + value;
    }, 0);
    const nextTaxAmount = Math.round(((nextSubtotal * taxPercent) / 100) * 100) / 100;
    const nextGrandTotal = Math.round((nextSubtotal + nextTaxAmount) * 100) / 100;
    return { subtotal: nextSubtotal, taxAmount: nextTaxAmount, grandTotal: nextGrandTotal };
  }, [rows, selectedTemplate, taxPercent]);

  const roundOff = useMemo(() => {
    if (!enableRoundOff || grandTotal === 0) return 0;
    return Math.round((Math.round(grandTotal) - grandTotal) * 100) / 100;
  }, [enableRoundOff, grandTotal]);

  const roundedGrandTotal = useMemo(
    () => (enableRoundOff ? Math.round(grandTotal) : grandTotal),
    [enableRoundOff, grandTotal]
  );

  const taxLabelText = useMemo(
    () => (isInterState ? "IGST" : "CGST + SGST"),
    [isInterState]
  );

  async function handleSave(status: "DRAFT" | "FINAL") {
    const mainScroll = document.querySelector("main");
    if (!selectedTemplate || !bill) {
      showToast("Please wait for bill data to load", "error");
      mainScroll?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const formErrors: Record<string, boolean> = {};
    if (!partyId) formErrors.partyId = true;
    if (!customerName.trim()) formErrors.customerName = true;
    if (status === "FINAL" && !placeOfSupply) formErrors.placeOfSupply = true;
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
          partyId, customerName: customerName.trim(),
          customerPhone: customerPhone.trim() || null,
          customerAddress: customerAddress.trim() || null,
          gstin: gstin.trim() || null,
          rows, notes: notes.trim() || null, terms: terms.trim() || null,
          taxPercent, subtotal, taxAmount, grandTotal: roundedGrandTotal, roundOff,
          billDate, isInterState, hsnCode: hsnCode.trim() || null,
          placeOfSupply: placeOfSupply.trim() || null, status,
        }),
      });
      if (!response.ok) throw new Error(await readError(response));
      showToast(`Bill updated and ${status === "DRAFT" ? "saved as draft" : "finalized"}!`, "success");
      window.setTimeout(() => router.push(`/bills/${id}`), 700);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to update bill", "error");
    } finally {
      setSavingAs(null);
    }
  }

  if (loading) {
    return (
      <div style={{ background: "var(--hk-bg)", minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <p style={{ color: "var(--hk-sub)", fontFamily: SG, fontSize: TYPE.body }}>Loading bill data...</p>
      </div>
    );
  }

  if (!bill || !selectedTemplate) {
    return (
      <div style={{ background: "var(--hk-bg)", minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <p style={{ color: "var(--hk-sub)", fontFamily: SG, fontSize: TYPE.body }}>Bill not found</p>
      </div>
    );
  }

  return (
    <>
      {toast && <HKToast message={toast.message} type={toast.type} />}

      <div style={{ background: "var(--hk-bg)", minHeight: "100%", fontFamily: SG }}>
        <PageHeader
          title="Edit Bill"
          subtitle="Update the linked party and the invoice snapshot."
          isMobile={isMobile}
          action={
            <button
              onClick={() => router.push(`/bills/${id}`)}
              style={{
                height: TOUCH.secondary, padding: "0 16px",
                borderRadius: 12, border: "1.5px solid var(--hk-border)",
                background: "var(--hk-card)", color: "var(--hk-sub)",
                fontSize: TYPE.bodySmall, fontWeight: 600, fontFamily: SG,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              Bills
            </button>
          }
        />

        <div style={{ padding: isMobile ? "0 14px 100px" : "0 28px 60px", maxWidth: 1100, margin: "0 auto" }}>
          {/* Template badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <span style={{
              fontSize: TYPE.bodySmall, fontWeight: 700, fontFamily: SG,
              padding: "4px 12px", borderRadius: 20,
              background: PU + "18", color: PU, border: `1px solid ${PU}30`,
            }}>
              {selectedTemplate.name}
            </span>
          </div>

          {/* Bill To */}
          <Section title="Bill To">
            <HKSelect
              label="Party"
              placeholder="Select customer or vendor"
              value={partyId}
              onValueChange={(v) => { if (v) applyPartySnapshot(v); }}
              isInvalid={Boolean(errors.partyId)}
              errorMessage={errors.partyId ? "Party is required" : undefined}
            >
              {parties.map((party) => (
                <HKSelectItem key={party.id} value={party.id}>
                  {`${party.name} — ${party.type.toLowerCase()}`}
                </HKSelectItem>
              ))}
            </HKSelect>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginTop: 12 }}>
              <HKInput
                label={t("bills.customer")}
                placeholder="Invoice display name"
                value={customerName}
                onValueChange={(v) => { setCustomerName(v); if (v.trim()) setErrors((c) => ({ ...c, customerName: false })); }}
                isRequired
                isInvalid={Boolean(errors.customerName)}
                errorMessage={errors.customerName ? "Customer name is required" : undefined}
              />
              <HKInput label="Phone" placeholder="Phone number" value={customerPhone} onValueChange={setCustomerPhone} type="tel" />
              <HKInput label="Address" placeholder="Billing address" value={customerAddress} onValueChange={setCustomerAddress} />
              <HKInput label="GSTIN" placeholder="GST Number (optional)" value={gstin} onValueChange={setGstin} />
            </div>
          </Section>

          {/* Line Items */}
          <HKCard style={{ marginBottom: 16, padding: 0 }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 20px 12px", borderBottom: "1px solid var(--hk-border)", flexWrap: "wrap", gap: 8,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--hk-text)", fontFamily: SG, margin: 0 }}>Line Items</p>
                <span style={{ fontSize: TYPE.bodySmall, color: "var(--hk-sub)", fontFamily: SG }}>
                  Subtotal: <span style={{ fontFamily: IN, fontWeight: 700, color: "var(--hk-text)" }}>{fmtFull(subtotal)}</span>
                </span>
                <span style={{ fontSize: TYPE.bodySmall, color: PU, fontFamily: SG }}>
                  Total: <span style={{ fontFamily: IN, fontWeight: 800 }}>{fmtFull(grandTotal)}</span>
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {taxPercent > 0 && (
                  <button
                    onClick={() => setHsnPerRow((v) => !v)}
                    style={{
                      height: TOUCH.secondary, padding: "0 12px",
                      borderRadius: 10, fontSize: TYPE.bodySmall, fontWeight: 600, fontFamily: SG,
                      border: `1.5px solid ${hsnPerRow ? PU : "var(--hk-border)"}`,
                      background: hsnPerRow ? PU + "18" : "transparent",
                      color: hsnPerRow ? PU : "var(--hk-sub)",
                      cursor: "pointer",
                    }}
                    title="Add HSN/SAC code per line item for GSTR-1 Table 12"
                  >
                    HSN per row
                  </button>
                )}
                <button
                  onClick={() => setShowCatalogPicker(true)}
                  style={{
                    height: TOUCH.secondary, padding: "0 12px",
                    borderRadius: 10, border: `1.5px solid ${PU}44`,
                    background: PU + "12", color: PU,
                    fontSize: TYPE.bodySmall, fontWeight: 600, fontFamily: SG,
                    cursor: "pointer",
                  }}
                >
                  Catalogue
                </button>
                <button
                  onClick={addRow}
                  style={{
                    height: TOUCH.secondary, padding: "0 14px",
                    borderRadius: 10, border: "none",
                    background: PU, color: "#fff",
                    fontSize: TYPE.bodySmall, fontWeight: 700, fontFamily: SG,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                  </svg>
                  Add Row
                </button>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: TYPE.bodySmall, fontFamily: SG }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--hk-border)", background: "var(--hk-badge)" }}>
                    <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 600, color: "var(--hk-sub)", width: 40 }}>#</th>
                    {hsnPerRow && taxPercent > 0 && (
                      <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "var(--hk-sub)", whiteSpace: "nowrap" }}>
                        HSN/SAC
                      </th>
                    )}
                    {selectedTemplate.columns.map((column) => (
                      <th key={column.id} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "var(--hk-sub)", whiteSpace: "nowrap" }}>
                        {column.name}
                        {column.type === "formula" && <span style={{ color: AM, marginLeft: 4, fontSize: 10 }}>fx</span>}
                      </th>
                    ))}
                    <th style={{ width: 40 }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr key={rowIndex} style={{ borderBottom: "1px solid var(--hk-border)" }}>
                      <td style={{ padding: "8px 12px", textAlign: "center", color: "var(--hk-sub)", fontSize: TYPE.bodySmall }}>{rowIndex + 1}</td>
                      {hsnPerRow && taxPercent > 0 && (
                        <td style={{ padding: "8px 8px" }}>
                          <input
                            type="text"
                            aria-label={`Row ${rowIndex + 1} HSN/SAC code`}
                            placeholder="e.g. 9983"
                            value={String(row._hsnCode || "")}
                            onChange={(e) => updateRowHsn(rowIndex, e.target.value)}
                            style={{ minWidth: 80, maxWidth: 100, background: "transparent", color: "var(--hk-text)", fontSize: TYPE.bodySmall, fontFamily: SG, outline: "none", border: "none", borderBottom: "1.5px solid var(--hk-border)", padding: "2px 0" }}
                          />
                        </td>
                      )}
                      {selectedTemplate.columns.map((column) => (
                        <td key={column.id} style={{ padding: "8px 8px" }}>
                          {column.type === "formula" ? (
                            <span style={{ fontFamily: IN, fontWeight: 700, color: GR, fontSize: TYPE.bodySmall }}>
                              {typeof row[column.id] === "number"
                                ? formatColumnValue(column.name, row[column.id] as number)
                                : "—"}
                            </span>
                          ) : column.type === "number" ? (
                            <input
                              type="number"
                              aria-label={`Row ${rowIndex + 1} ${column.name}`}
                              value={String(row[column.id] || "")}
                              onChange={(e) => updateCell(rowIndex, column.id, e.target.value)}
                              style={{ minWidth: 80, background: "transparent", color: "var(--hk-text)", fontSize: TYPE.bodySmall, fontFamily: IN, outline: "none", border: "none", borderBottom: "1.5px solid var(--hk-border)", padding: "2px 0" }}
                            />
                          ) : column.type === "dropdown" && column.options ? (
                            <HKSelect
                              aria-label={`Row ${rowIndex + 1} ${column.name}`}
                              placeholder={column.name}
                              value={row[column.id] ? String(row[column.id]) : ""}
                              onValueChange={(v) => { if (v) updateCell(rowIndex, column.id, v); }}
                              size="sm"
                            >
                              {column.options.map((option) => (
                                <HKSelectItem key={option} value={option}>{option}</HKSelectItem>
                              ))}
                            </HKSelect>
                          ) : column.type === "date" ? (
                            <input
                              type="date"
                              aria-label={`Row ${rowIndex + 1} ${column.name}`}
                              value={String(row[column.id] || "")}
                              onChange={(e) => updateCell(rowIndex, column.id, e.target.value)}
                              style={{ minWidth: 130, background: "transparent", color: "var(--hk-text)", fontSize: TYPE.bodySmall, fontFamily: SG, outline: "none", border: "none", borderBottom: "1.5px solid var(--hk-border)", padding: "2px 0" }}
                            />
                          ) : (
                            <input
                              type="text"
                              aria-label={`Row ${rowIndex + 1} ${column.name}`}
                              value={String(row[column.id] || "")}
                              onChange={(e) => updateCell(rowIndex, column.id, e.target.value)}
                              style={{ minWidth: 120, background: "transparent", color: "var(--hk-text)", fontSize: TYPE.bodySmall, fontFamily: SG, outline: "none", border: "none", borderBottom: "1.5px solid var(--hk-border)", padding: "2px 0" }}
                            />
                          )}
                        </td>
                      ))}
                      <td style={{ padding: "8px 8px", textAlign: "center" }}>
                        <button
                          onClick={() => removeRow(rowIndex)}
                          disabled={rows.length <= 1}
                          aria-label={`Remove row ${rowIndex + 1}`}
                          style={{
                            width: 28, height: 28, borderRadius: 8, border: "none",
                            background: "transparent",
                            color: rows.length <= 1 ? "var(--hk-border)" : OR,
                            cursor: rows.length <= 1 ? "default" : "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >
                          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </HKCard>

          {/* Notes + Summary */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 24 }}>
            {/* Notes */}
            <HKCard style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <HKTextarea label="Notes" placeholder="Additional notes..." value={notes} onValueChange={setNotes} minRows={2} />
              <HKTextarea label="Terms & Conditions" placeholder="Enter terms..." value={terms} onValueChange={setTerms} minRows={3} />
            </HKCard>

            {/* Summary */}
            <HKCard style={{ background: PU + "08", border: `1px solid ${PU}20` }}>
              <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--hk-text)", fontFamily: SG, marginBottom: 16 }}>Summary</p>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ color: "var(--hk-sub)", fontSize: TYPE.body, fontFamily: SG, flexShrink: 0 }}>Bill Date</span>
                  <HKInput
                    type="date"
                    aria-label="Bill date"
                    value={billDate}
                    onValueChange={setBillDate}
                    size="sm"
                    className="max-w-[180px]"
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--hk-sub)", fontSize: TYPE.body, fontFamily: SG }}>Subtotal</span>
                  <span style={{ fontFamily: IN, fontWeight: 600, color: "var(--hk-text)" }}>{fmtFull(subtotal)}</span>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "var(--hk-sub)", fontSize: TYPE.body, fontFamily: SG }}>{taxLabelText}</span>
                    <HKInput
                      type="number"
                      aria-label="Tax percentage"
                      value={String(taxPercent)}
                      onValueChange={(value) => setTaxPercent(Number.parseFloat(value) || 0)}
                      size="sm"
                      className="w-20"
                      endContent={<span style={{ fontSize: TYPE.bodySmall, color: "var(--hk-sub)" }}>%</span>}
                    />
                  </div>
                  <span style={{ fontFamily: IN, fontWeight: 600, color: "var(--hk-text)" }}>{fmtFull(taxAmount)}</span>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <p style={{ fontSize: TYPE.caption, color: "var(--hk-sub)", fontFamily: SG, margin: 0 }}>{t("bills.autoTaxNote")}</p>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={isInterState}
                      onChange={(e) => setIsInterState(e.target.checked)}
                      style={{ accentColor: PU }}
                    />
                    <span style={{ fontSize: TYPE.caption, color: "var(--hk-sub)", fontFamily: SG }}>Inter-state (IGST)</span>
                  </label>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ fontSize: TYPE.bodySmall, color: "var(--hk-sub)", fontFamily: SG, flexShrink: 0 }}>Place of Supply</span>
                  <HKSelect
                    aria-label="Place of supply"
                    placeholder="State select karo"
                    size="sm"
                    value={placeOfSupply}
                    onValueChange={(v) => { setPlaceOfSupply(v ?? ""); if (v) setErrors((c) => ({ ...c, placeOfSupply: false })); }}
                    isInvalid={Boolean(errors.placeOfSupply)}
                    errorMessage={errors.placeOfSupply ? "Required for final bills" : undefined}
                  >
                    {Object.entries(GST_STATE_CODES).map(([code, name]) => (
                      <HKSelectItem key={code} value={code}>{code} — {name}</HKSelectItem>
                    ))}
                  </HKSelect>
                </div>

                {!hsnPerRow && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: TYPE.bodySmall, color: "var(--hk-sub)", fontFamily: SG, flexShrink: 0 }}>HSN/SAC Code</span>
                    <HKInput
                      aria-label="HSN/SAC Code"
                      placeholder="e.g. 9983"
                      size="sm"
                      value={hsnCode}
                      onValueChange={setHsnCode}
                      className="max-w-[200px]"
                    />
                  </div>
                )}
                {hsnPerRow && taxPercent > 0 && (
                  <p style={{ fontSize: TYPE.caption, color: "var(--hk-sub)", fontFamily: SG, margin: 0 }}>
                    HSN/SAC entered per row above (GSTR-1 Table 12)
                  </p>
                )}

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: grandTotal === 0 ? "not-allowed" : "pointer", opacity: grandTotal === 0 ? 0.4 : 1 }}>
                    <input
                      type="checkbox"
                      checked={enableRoundOff}
                      onChange={(e) => { if (grandTotal !== 0) setEnableRoundOff(e.target.checked); }}
                      disabled={grandTotal === 0}
                      style={{ accentColor: PU }}
                    />
                    <span style={{ fontSize: TYPE.caption, color: "var(--hk-sub)", fontFamily: SG }}>Round off to nearest ₹</span>
                  </label>
                  {enableRoundOff && roundOff !== 0 && (
                    <span style={{ fontSize: TYPE.bodySmall, fontFamily: IN, fontWeight: 600, color: roundOff > 0 ? GR : OR }}>
                      {roundOff > 0 ? "+" : ""}{fmtFull(roundOff)}
                    </span>
                  )}
                </div>

                <div style={{ borderTop: "1px solid var(--hk-border)", paddingTop: 12, marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: TYPE.h2, fontWeight: 800, color: "var(--hk-text)", fontFamily: SG }}>Grand Total</span>
                  <span style={{ fontSize: TYPE.numMedium, fontWeight: 800, color: PU, fontFamily: IN }}>{fmtFull(roundedGrandTotal)}</span>
                </div>
              </div>
            </HKCard>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              onClick={() => router.push(`/bills/${id}`)}
              style={{
                height: TOUCH.primary, padding: "0 20px",
                borderRadius: 12, border: "1.5px solid var(--hk-border)",
                background: "var(--hk-card)", color: "var(--hk-sub)",
                fontSize: TYPE.body, fontWeight: 600, fontFamily: SG,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => handleSave("DRAFT")}
              disabled={savingAs === "FINAL"}
              style={{
                height: TOUCH.primary, padding: "0 20px",
                borderRadius: 12, border: "1.5px solid var(--hk-border)",
                background: savingAs === "DRAFT" ? "var(--hk-badge)" : "var(--hk-card)",
                color: "var(--hk-text)",
                fontSize: TYPE.body, fontWeight: 600, fontFamily: SG,
                cursor: savingAs === "FINAL" ? "not-allowed" : "pointer",
                opacity: savingAs === "FINAL" ? 0.5 : 1,
              }}
            >
              {savingAs === "DRAFT" ? "Saving..." : t("bills.saveDraft")}
            </button>
            <HKButton onClick={() => handleSave("FINAL")} isLoading={savingAs === "FINAL"} isDisabled={savingAs === "DRAFT"}>
              Finalize Update
            </HKButton>
          </div>
        </div>
      </div>

      {showCatalogPicker && selectedTemplate && (
        <ItemCatalogPicker
          columns={selectedTemplate.columns}
          onSelect={handleCatalogSelect}
          onClose={() => setShowCatalogPicker(false)}
        />
      )}
    </>
  );
}
