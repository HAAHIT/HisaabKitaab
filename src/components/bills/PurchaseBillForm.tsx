"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HKButton } from "@/components/ui/HKButton";
import { HKInput } from "@/components/ui/HKInput";
import { HKSelect, HKSelectItem } from "@/components/ui/HKSelect";
import { HKTextarea } from "@/components/ui/HKTextarea";
import { HKCheckbox } from "@/components/ui/HKCheckbox";
import { useRouter } from "next/navigation";
import { PartySearch, type PartyOption } from "@/components/ui/PartySearch";
import { useLanguage } from "@/contexts/LanguageContext";
import { evaluateRow, type ColumnDef } from "@/lib/formula";
import { GST_STATE_CODES } from "@/lib/gst-states";
import {
  OR, GR, AM, PU, SG, IN, TYPE, TOUCH,
  HKCard, HKToast, PageHeader, fmtFull, useIsMobile,
} from "@/components/ui/hk-design";

interface Template {
  id: string;
  name: string;
  columns: ColumnDef[];
}

function buildEmptyRow(template: Template) {
  return template.columns.reduce<Record<string, string | number>>((row, column) => {
    row[column.id] = column.type === "number" || column.type === "formula" ? 0 : "";
    return row;
  }, {});
}

function formatColumnValue(columnName: string, value: number) {
  const lower = columnName.toLowerCase();
  const isCurrency =
    lower.includes("rate") || lower.includes("price") ||
    lower.includes("amount") || lower.includes("total") || lower.includes("rs");
  if (isCurrency) return fmtFull(value);
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
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

export function PurchaseBillForm() {
  const router = useRouter();
  const { t } = useLanguage();
  const isMobile = useIsMobile();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingAs, setSavingAs] = useState<"DRAFT" | "FINAL" | null>(null);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [selectedParty, setSelectedParty] = useState<PartyOption | null>(null);
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState("");
  const [billDate, setBillDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Record<string, string | number>[]>([]);
  const [taxPercent, setTaxPercent] = useState(18);
  const [isInterState, setIsInterState] = useState(false);
  const [isReverseCharge, setIsReverseCharge] = useState(false);
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [notes, setNotes] = useState("");
  const [enableRoundOff, setEnableRoundOff] = useState(false);

  const fetchFormData = useCallback(async () => {
    setLoading(true);
    try {
      const [templRes, setRes] = await Promise.all([fetch("/api/templates"), fetch("/api/settings")]);
      const [tData, sData] = await Promise.all([templRes.json(), setRes.json()]);
      setTemplates(tData.templates || []);
      if (sData.settings) setTaxPercent(sData.settings.defaultTaxPercent || 18);
    } catch {
      showToast("Failed to load form data", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFormData(); }, [fetchFormData]);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }

  const selectTemplate = useCallback((templateId: string) => {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    setSelectedTemplate(template);
    setRows([buildEmptyRow(template)]);
    setTemplatePickerOpen(false);
  }, [templates]);

  useEffect(() => {
    if (selectedTemplate || templates.length === 0) return;
    selectTemplate(templates[0].id);
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
      if (selectedTemplate) nextRows[rowIndex] = evaluateRow(nextRows[rowIndex], selectedTemplate.columns);
      return nextRows;
    });
  }

  const { subtotal, taxAmount, grandTotal } = useMemo(() => {
    if (!selectedTemplate) return { subtotal: 0, taxAmount: 0, grandTotal: 0 };
    const lastValueColumn = [...selectedTemplate.columns].reverse().find((c) => c.type === "formula" || c.type === "number");
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

  const taxLabelText = isInterState ? "IGST" : "CGST + SGST";

  async function handleSave(status: "DRAFT" | "FINAL") {
    if (!selectedTemplate) { showToast("Please select a template", "error"); return; }
    const formErrors: Record<string, boolean> = {};
    if (!selectedParty) formErrors.partyId = true;
    if (status === "FINAL" && !placeOfSupply) formErrors.placeOfSupply = true;
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      showToast("Please fill in required fields", "error");
      window.setTimeout(() => setErrors({}), 3000);
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
          rows, subtotal, taxPercent, taxAmount,
          grandTotal: roundedGrandTotal, roundOff,
          isInterState, isReverseCharge,
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
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to create purchase", "error");
    } finally {
      setSavingAs(null);
    }
  }

  return (
    <>
      {toast && <HKToast message={toast.message} type={toast.type} />}

      <div style={{ background: "var(--hk-bg)", minHeight: "100%", fontFamily: SG }}>
        <PageHeader
          title="New Purchase Bill"
          subtitle="Record an incoming purchase from a supplier"
          isMobile={isMobile}
          action={
            <button
              onClick={() => router.back()}
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
              Back
            </button>
          }
        />

        <div style={{ padding: isMobile ? "0 14px 100px" : "0 28px 60px", maxWidth: 1100, margin: "0 auto" }}>

          {/* Template picker */}
          {(templatePickerOpen || (!loading && !selectedTemplate && templates.length === 0)) && (
            <HKCard style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--hk-text)", fontFamily: SG }}>Choose Template</p>
                {templatePickerOpen && (
                  <button onClick={() => setTemplatePickerOpen(false)} style={{ fontSize: TYPE.bodySmall, color: "var(--hk-sub)", background: "none", border: "none", cursor: "pointer", fontFamily: SG }}>
                    Cancel
                  </button>
                )}
              </div>
              {loading ? (
                <p style={{ color: "var(--hk-sub)", fontSize: TYPE.body }}>Loading templates...</p>
              ) : templates.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <p style={{ color: "var(--hk-sub)", marginBottom: 12, fontSize: TYPE.body }}>No templates found</p>
                  <HKButton onClick={() => router.push("/settings/templates/new")}>Create Template</HKButton>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => selectTemplate(template.id)}
                      style={{
                        padding: 16, borderRadius: 14,
                        border: "1.5px solid var(--hk-border)",
                        background: "var(--hk-card)", textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <p style={{ fontSize: TYPE.body, fontWeight: 700, color: "var(--hk-text)", fontFamily: SG }}>{template.name}</p>
                      <p style={{ fontSize: TYPE.caption, color: "var(--hk-sub)", marginTop: 4 }}>{template.columns.length} columns</p>
                    </button>
                  ))}
                </div>
              )}
            </HKCard>
          )}

          {selectedTemplate && (
            <>
              {/* Template badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span style={{
                  fontSize: TYPE.bodySmall, fontWeight: 700, fontFamily: SG,
                  padding: "4px 12px", borderRadius: 20,
                  background: AM + "18", color: AM, border: `1px solid ${AM}30`,
                }}>
                  {selectedTemplate.name}
                </span>
                <button
                  onClick={() => setTemplatePickerOpen(true)}
                  style={{ fontSize: TYPE.bodySmall, color: "var(--hk-sub)", background: "none", border: "none", cursor: "pointer", fontFamily: SG, fontWeight: 600 }}
                >
                  Change
                </button>
              </div>

              {/* Vendor + Invoice Details */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <Section title="Vendor Details">
                  <PartySearch
                    value={selectedParty?.id || null}
                    onChange={(party) => {
                      setSelectedParty(party);
                      if (party?.gstin && party.gstin.length >= 2) {
                        const code = party.gstin.substring(0, 2);
                        if (GST_STATE_CODES[code]) setPlaceOfSupply(code);
                      }
                      setErrors((c) => ({ ...c, partyId: false }));
                    }}
                    partyType="VENDOR"
                    placeholder="Search Supplier..."
                    isInvalid={Boolean(errors.partyId)}
                  />
                  {selectedParty && (
                    <div style={{ marginTop: 14, padding: "14px 16px", borderRadius: 12, background: "var(--hk-badge)", border: "1px solid var(--hk-border)" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <p style={{ fontSize: TYPE.body, fontWeight: 700, color: "var(--hk-text)", fontFamily: SG }}>{selectedParty.name}</p>
                        <button onClick={() => setSelectedParty(null)} style={{ fontSize: TYPE.bodySmall, color: "var(--hk-sub)", background: "none", border: "none", cursor: "pointer", fontFamily: SG, fontWeight: 600 }}>
                          Change
                        </button>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {selectedParty.phone && <p style={{ fontSize: TYPE.bodySmall, color: "var(--hk-sub)", fontFamily: SG }}>📱 {selectedParty.phone}</p>}
                        {selectedParty.address && <p style={{ fontSize: TYPE.bodySmall, color: "var(--hk-sub)", fontFamily: SG }}>📍 {selectedParty.address}</p>}
                        {selectedParty.gstin && <p style={{ fontSize: TYPE.bodySmall, color: "var(--hk-sub)", fontFamily: IN }}>GST: {selectedParty.gstin}</p>}
                      </div>
                      {selectedParty.currentBalance !== 0 && (
                        <div style={{
                          marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--hk-border)",
                          fontSize: TYPE.bodySmall, fontWeight: 700, fontFamily: SG,
                          color: selectedParty.currentBalance > 0 ? OR : GR,
                        }}>
                          {selectedParty.currentBalance > 0
                            ? `To Pay: ${fmtFull(selectedParty.currentBalance)}`
                            : `Advance: ${fmtFull(Math.abs(selectedParty.currentBalance))}`}
                        </div>
                      )}
                    </div>
                  )}
                </Section>

                <Section title="Invoice Details">
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <HKInput label="Supplier Invoice No" value={supplierInvoiceNo} onValueChange={setSupplierInvoiceNo} placeholder="e.g. INV/2024/001" />
                    <HKInput label="Bill Date" type="date" value={billDate} onValueChange={setBillDate} />
                  </div>
                </Section>
              </div>

              {/* Line Items */}
              <HKCard style={{ marginBottom: 16, padding: 0 }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "16px 20px 12px", borderBottom: "1px solid var(--hk-border)", flexWrap: "wrap", gap: 8,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--hk-text)", fontFamily: SG, margin: 0 }}>Line Items</p>
                    <span style={{ fontSize: TYPE.bodySmall, color: "var(--hk-sub)", fontFamily: SG }}>
                      Subtotal: <span style={{ fontFamily: IN, fontWeight: 700, color: "var(--hk-text)" }}>{fmtFull(subtotal)}</span>
                    </span>
                  </div>
                  <button
                    onClick={addRow}
                    style={{
                      height: TOUCH.secondary, padding: "0 14px",
                      borderRadius: 10, border: "none",
                      background: AM, color: "#fff",
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
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: TYPE.bodySmall, fontFamily: SG }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--hk-border)", background: "var(--hk-badge)" }}>
                        <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 600, color: "var(--hk-sub)", width: 40 }}>#</th>
                        {selectedTemplate.columns.map((col) => (
                          <th key={col.id} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "var(--hk-sub)", whiteSpace: "nowrap" }}>
                            {col.name}
                            {col.type === "formula" && <span style={{ color: AM, marginLeft: 4, fontSize: 10 }}>fx</span>}
                          </th>
                        ))}
                        <th style={{ width: 40 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, rIdx) => (
                        <tr key={rIdx} style={{ borderBottom: "1px solid var(--hk-border)" }}>
                          <td style={{ padding: "8px 12px", textAlign: "center", color: "var(--hk-sub)", fontSize: TYPE.bodySmall }}>{rIdx + 1}</td>
                          {selectedTemplate.columns.map((col) => (
                            <td key={col.id} style={{ padding: "8px 8px" }}>
                              {col.type === "formula" ? (
                                <span style={{ fontFamily: IN, fontWeight: 700, color: GR, fontSize: TYPE.bodySmall }}>
                                  {typeof row[col.id] === "number" ? formatColumnValue(col.name, row[col.id] as number) : "—"}
                                </span>
                              ) : col.type === "number" ? (
                                <input
                                  type="number"
                                  aria-label={`Row ${rIdx + 1} ${col.name}`}
                                  value={String(row[col.id] || "")}
                                  onChange={(e) => updateCell(rIdx, col.id, e.target.value)}
                                  style={{ minWidth: 80, background: "transparent", color: "var(--hk-text)", fontSize: TYPE.bodySmall, fontFamily: IN, outline: "none", border: "none", borderBottom: "1.5px solid var(--hk-border)", padding: "2px 0" }}
                                />
                              ) : (
                                <input
                                  type="text"
                                  aria-label={`Row ${rIdx + 1} ${col.name}`}
                                  value={String(row[col.id] || "")}
                                  onChange={(e) => updateCell(rIdx, col.id, e.target.value)}
                                  style={{ minWidth: 120, background: "transparent", color: "var(--hk-text)", fontSize: TYPE.bodySmall, fontFamily: SG, outline: "none", border: "none", borderBottom: "1.5px solid var(--hk-border)", padding: "2px 0" }}
                                />
                              )}
                            </td>
                          ))}
                          <td style={{ padding: "8px 8px", textAlign: "center" }}>
                            <button
                              onClick={() => removeRow(rIdx)}
                              disabled={rows.length <= 1}
                              aria-label={`Remove row ${rIdx + 1}`}
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
                {/* Notes + Checkboxes */}
                <HKCard style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <HKTextarea label="Notes" placeholder="Additional notes..." value={notes} onValueChange={setNotes} minRows={3} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <HKCheckbox isSelected={isInterState} onValueChange={setIsInterState}>
                      Inter-State Transaction (IGST)
                    </HKCheckbox>
                    <HKCheckbox isSelected={isReverseCharge} onValueChange={setIsReverseCharge}>
                      Subject to Reverse Charge (RCM)
                    </HKCheckbox>
                  </div>
                </HKCard>

                {/* Summary */}
                <HKCard style={{ background: AM + "08", border: `1px solid ${AM}20` }}>
                  <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--hk-text)", fontFamily: SG, marginBottom: 16 }}>Summary</p>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
                          onValueChange={(v) => setTaxPercent(Number.parseFloat(v) || 0)}
                          size="sm"
                          className="w-20"
                          endContent={<span style={{ fontSize: TYPE.bodySmall, color: "var(--hk-sub)" }}>%</span>}
                        />
                      </div>
                      <span style={{ fontFamily: IN, fontWeight: 600, color: "var(--hk-text)" }}>{fmtFull(taxAmount)}</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <span style={{ fontSize: TYPE.bodySmall, color: "var(--hk-sub)", fontFamily: SG, flexShrink: 0 }}>Place of Supply</span>
                      <HKSelect
                        aria-label="Place of supply"
                        placeholder="Select state"
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

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: grandTotal === 0 ? "not-allowed" : "pointer", opacity: grandTotal === 0 ? 0.4 : 1 }}>
                        <input
                          type="checkbox"
                          checked={enableRoundOff}
                          onChange={(e) => { if (grandTotal !== 0) setEnableRoundOff(e.target.checked); }}
                          disabled={grandTotal === 0}
                          style={{ accentColor: AM }}
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
                      <span style={{ fontSize: TYPE.numMedium, fontWeight: 800, color: AM, fontFamily: IN }}>{fmtFull(roundedGrandTotal)}</span>
                    </div>
                  </div>
                </HKCard>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <HKButton variant="secondary" onClick={() => router.back()}>Cancel</HKButton>
                <HKButton variant="secondary" isLoading={savingAs === "DRAFT"} isDisabled={savingAs === "FINAL"} onClick={() => handleSave("DRAFT")}>
                  Save Draft
                </HKButton>
                <HKButton isLoading={savingAs === "FINAL"} isDisabled={savingAs === "DRAFT"} onClick={() => handleSave("FINAL")}>
                  Confirm Purchase
                </HKButton>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
