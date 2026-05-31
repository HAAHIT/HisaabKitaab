"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HKSelect, HKSelectItem } from "@/components/ui/HKSelect";
import { HKTextarea } from "@/components/ui/HKTextarea";
import { useRouter, useSearchParams } from "next/navigation";
import { PartySearch, type PartyOption } from "@/components/ui/PartySearch";
import { useLanguage } from "@/contexts/LanguageContext";
import { type TranslationKey } from "@/lib/i18n/translations";
import { evaluateRow, type ColumnDef } from "@/lib/formula";
import { GST_STATE_CODES } from "@/lib/gst-states";
import { deriveIsInterState, extractGstinStateCode } from "@/lib/gst-helpers";
import {
  C, OR, GR, AM, PU, SG, IN, TYPE, TOUCH, DISPLAY,
  HKCard, HKToast,
  fmtFull, useIsMobile,
} from "@/components/ui/hk-design";
import { HKButton } from "@/components/ui/HKButton";
import { HKInput } from "@/components/ui/HKInput";
import { dispatchQuotaExceeded } from "@/components/billing/QuotaProvider";
import { BillCreationTour } from "@/components/onboarding/BillCreationTour";

interface Template {
  id: string;
  name: string;
  columns: ColumnDef[];
}

interface CatalogItem {
  id: string;
  name: string;
  hsnCode: string | null;
  unit: string;
  rate: number;
  taxRate: number | null;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatColumnValue(columnName: string, value: number) {
  const lower = columnName.toLowerCase();
  const isCurrency = lower.includes("rate") || lower.includes("price") || lower.includes("amount") || lower.includes("total") || lower.includes("rs");
  return isCurrency
    ? formatCurrency(value)
    : new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
}

async function readError(response: Response) {
  const data = await response.json().catch(() => null);
  return data?.error || "Request failed";
}

function buildEmptyRow(template: Template) {
  return template.columns.reduce<Record<string, string | number>>((row, column) => {
    if (column.default !== undefined) {
      row[column.id] = column.default;
    } else {
      row[column.id] = column.type === "number" || column.type === "formula" ? 0 : "";
    }
    return row;
  }, {});
}

// ─── Section card wrapper ─────────────────────────────────────────────────────

function Section({ title, action, children }: { title?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <HKCard style={{ marginBottom: 16, padding: 0, overflow: "visible" }}>
      {(title || action) && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px 12px", borderBottom: "1px solid var(--sb-border)",
        }}>
          {title && <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--sb-text)", fontFamily: SG }}>{title}</p>}
          {action}
        </div>
      )}
      <div style={{ padding: 20 }}>{children}</div>
    </HKCard>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NewBillPage() {
  return <BillFormPage />;
}

export function BillFormPage({ editBillId }: { editBillId?: string } = {}) {
  const isEdit = Boolean(editBillId);
  const router = useRouter();
  const { t } = useLanguage();
  const isMobile = useIsMobile();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [defaultTemplateId, setDefaultTemplateId] = useState<string | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingAs, setSavingAs] = useState<"DRAFT" | "FINAL" | null>(null);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const searchParams = useSearchParams();
  const preselectedPartyId = searchParams.get("partyId");
  const tourMode = searchParams.get("tour") === "1";
  const [tourDismissed, setTourDismissed] = useState(false);
  const [billFinalized, setBillFinalized] = useState(false);
  const [finalizeSeconds, setFinalizeSeconds] = useState<number | undefined>(undefined);
  const openedAtRef = useRef<number>(typeof performance !== "undefined" ? performance.now() : Date.now());

  const [selectedParty, setSelectedParty] = useState<PartyOption | null>(null);
  const [rows, setRows] = useState<Record<string, string | number>[]>([]);
  const [taxPercent, setTaxPercent] = useState(18);
  const [isInterState, setIsInterState] = useState(false);
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [didAutoFocusRow, setDidAutoFocusRow] = useState(false);
  const [enableRoundOff, setEnableRoundOff] = useState(false);
  const [billDate, setBillDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [companyGstin, setCompanyGstin] = useState("");
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [autoFocusedRow, setAutoFocusedRow] = useState<number | null>(null);
  const nameInputRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const gstIsLocked = Boolean(selectedParty?.gstin);

  const fetchFormData = useCallback(async () => {
    setLoading(true);
    try {
      const [templatesResponse, partiesResponse, settingsResponse, itemsResponse, billResponse] = await Promise.all([
        fetch("/api/templates"),
        fetch("/api/parties"),
        fetch("/api/settings"),
        fetch("/api/items"),
        editBillId ? fetch(`/api/bills/${editBillId}`) : Promise.resolve(null),
      ]);
      const [templatesData, partiesData, settingsData, itemsData, billData] = await Promise.all([
        templatesResponse.json().catch(() => ({ templates: [] })),
        partiesResponse.json().catch(() => ({ parties: [] })),
        settingsResponse.json().catch(() => ({ settings: null })),
        itemsResponse.json().catch(() => ({ items: [] })),
        billResponse ? billResponse.json().catch(() => null) : Promise.resolve(null),
      ]);
      const nextTemplates = (templatesData.templates || []) as Template[];
      const nextParties = (partiesData.parties || []) as PartyOption[];
      setTemplates(nextTemplates);
      setParties(nextParties);
      setCatalogItems(itemsData.items || []);
      if (settingsData.settings) {
        setTaxPercent(settingsData.settings.defaultTaxPercent || 18);
        setTerms(settingsData.settings.defaultTerms || "");
        setDefaultTemplateId(settingsData.settings.defaultTemplateId || null);
        setCompanyGstin(settingsData.settings.companyGstin || "");
      }
      if (editBillId && billData?.bill) {
        const b = billData.bill;
        const tpl = nextTemplates.find((tp) => tp.id === b.templateId) || null;
        if (tpl) {
          setSelectedTemplate(tpl);
          setRows(Array.isArray(b.rows) ? b.rows : [buildEmptyRow(tpl)]);
        }
        const party = nextParties.find((p) => p.id === b.partyId) || null;
        if (party) setSelectedParty(party);
        setTaxPercent(Number(b.taxPercent) || 0);
        setIsInterState(b.isInterState === true);
        setPlaceOfSupply(b.placeOfSupply || "");
        setNotes(b.notes || "");
        setTerms(b.terms || "");
        if (b.roundOff && Number(b.roundOff) !== 0) setEnableRoundOff(true);
        if (b.date) setBillDate(new Date(b.date).toISOString().slice(0, 10));
      }
    } catch {
      showToast(t("bills.loadFailed" as TranslationKey), "error");
    } finally {
      setLoading(false);
    }
  }, [editBillId]);

  useEffect(() => { fetchFormData(); }, [fetchFormData]);

  useEffect(() => {
    if (preselectedPartyId && parties.length > 0 && !selectedParty) {
      const party = parties.find((p) => p.id === preselectedPartyId);
      if (party) setSelectedParty(party);
    }
  }, [preselectedPartyId, parties, selectedParty]);

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
    if (defaultTemplateId) {
      const found = templates.find((t) => t.id === defaultTemplateId);
      if (found) { selectTemplate(found.id); return; }
    }
    selectTemplate(templates[0].id);
  }, [selectTemplate, selectedTemplate, templates, defaultTemplateId]);

  function addRow() {
    if (!selectedTemplate) return;
    setRows((prev) => [...prev, buildEmptyRow(selectedTemplate)]);
  }

  function removeRow(index: number) {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((_, i) => i !== index));
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

  function updateRowHsn(rowIndex: number, value: string) {
    setRows((prev) => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], _hsnCode: value };
      return next;
    });
  }

  const firstEditableColumnId = useMemo(() => {
    if (!selectedTemplate) return null;
    return selectedTemplate.columns.find((column) => column.type !== "formula")?.id ?? null;
  }, [selectedTemplate]);

  const nameColId = useMemo(() => {
    if (!selectedTemplate) return null;
    const nameHints = ["name", "item", "description", "desc", "product", "particulars", "detail"];
    const byHint = selectedTemplate.columns.find((c) => c.type === "text" && nameHints.some((h) => c.name.toLowerCase().includes(h)));
    return byHint ? byHint.id : selectedTemplate.columns.find((c) => c.type === "text")?.id ?? null;
  }, [selectedTemplate]);

  const rateColId = useMemo(() => {
    if (!selectedTemplate) return null;
    const taxHints = ["tax rate", "tax%", "gst rate", "gst%", "gst"];
    const rateHints = ["rate", "price", "mrp", "unit price", "unit rate"];
    return selectedTemplate.columns.find((c) => c.type === "number" && !taxHints.some((h) => c.name.toLowerCase().includes(h)) && rateHints.some((h) => c.name.toLowerCase().includes(h)))?.id ?? null;
  }, [selectedTemplate]);

  const qtyColId = useMemo(() => {
    if (!selectedTemplate) return null;
    const qtyHints = ["qty", "quantity", "nos", "pcs", "count", "units"];
    return selectedTemplate.columns.find((c) => c.type === "number" && qtyHints.some((h) => c.name.toLowerCase().includes(h)))?.id ?? null;
  }, [selectedTemplate]);

  const hsnColId = useMemo(() => {
    if (!selectedTemplate) return null;
    const hsnHints = ["hsn", "sac"];
    return selectedTemplate.columns.find((c) => c.type === "text" && hsnHints.some((h) => c.name.toLowerCase().includes(h)))?.id ?? null;
  }, [selectedTemplate]);

  const taxRateColId = useMemo(() => {
    if (!selectedTemplate) return null;
    const taxHints = ["tax rate", "tax%", "gst rate", "gst%", "gst"];
    return selectedTemplate.columns.find((c) => c.type === "number" && taxHints.some((h) => c.name.toLowerCase().includes(h)))?.id ?? null;
  }, [selectedTemplate]);

  const { subtotal, taxAmount, grandTotal } = useMemo(() => {
    if (!selectedTemplate) return { subtotal: 0, taxAmount: 0, grandTotal: 0 };
    const lastValueColumn = [...selectedTemplate.columns].reverse().find((c) => c.type === "formula" || c.type === "number");
    if (!lastValueColumn) return { subtotal: 0, taxAmount: 0, grandTotal: 0 };
    const nextSubtotal = taxRateColId
      ? Math.round(rows.reduce((sum, row) => {
          const rate = typeof row[rateColId ?? ""] === "number" ? (row[rateColId ?? ""] as number) : 0;
          const qty = typeof row[qtyColId ?? ""] === "number" ? (row[qtyColId ?? ""] as number) : 0;
          return sum + rate * qty;
        }, 0) * 100) / 100
      : rows.reduce((sum, row) => {
          const value = typeof row[lastValueColumn.id] === "number" ? (row[lastValueColumn.id] as number) : 0;
          return sum + value;
        }, 0);
    const nextTaxAmount = taxRateColId
      ? Math.round(rows.reduce((sum, row) => {
          const rate = typeof row[rateColId ?? ""] === "number" ? (row[rateColId ?? ""] as number) : 0;
          const qty = typeof row[qtyColId ?? ""] === "number" ? (row[qtyColId ?? ""] as number) : 0;
          const taxRate = typeof row[taxRateColId] === "number" ? (row[taxRateColId] as number) : 0;
          return sum + (rate * qty * taxRate) / 100;
        }, 0) * 100) / 100
      : Math.round(((nextSubtotal * taxPercent) / 100) * 100) / 100;
    const nextGrandTotal = Math.round((nextSubtotal + nextTaxAmount) * 100) / 100;
    return { subtotal: nextSubtotal, taxAmount: nextTaxAmount, grandTotal: nextGrandTotal };
  }, [rows, selectedTemplate, taxPercent, taxRateColId, rateColId, qtyColId]);

  const roundOff = useMemo(() => {
    if (!enableRoundOff || grandTotal === 0) return 0;
    return Math.round((Math.round(grandTotal) - grandTotal) * 100) / 100;
  }, [enableRoundOff, grandTotal]);

  const roundedGrandTotal = useMemo(
    () => (enableRoundOff ? Math.round(grandTotal) : grandTotal),
    [enableRoundOff, grandTotal]
  );

  // Unique tax rate across rows — null means multiple distinct rates exist
  const uniqueTaxRate = useMemo<number | null>(() => {
    if (!taxRateColId) return taxPercent;
    const rates = rows
      .map((r) => (typeof r[taxRateColId] === "number" ? (r[taxRateColId] as number) : 0))
      .filter((r) => r > 0);
    if (rates.length === 0) return taxPercent;
    const uniq = [...new Set(rates)];
    return uniq.length === 1 ? uniq[0] : null;
  }, [taxRateColId, rows, taxPercent]);

  const taxLabelText = useMemo(() => {
    if (taxRateColId !== null) {
      if (uniqueTaxRate === null)
        return isInterState ? "Output IGST" : "Output CGST + Output SGST";
      if (uniqueTaxRate === 0) return "Tax";
      if (isInterState) return `IGST @ ${uniqueTaxRate}%`;
      const half = uniqueTaxRate / 2;
      return `CGST @ ${half}% + SGST @ ${half}%`;
    }
    return isInterState ? "IGST" : "CGST + SGST";
  }, [taxRateColId, uniqueTaxRate, isInterState]);

  const autoFilteredItems = useMemo(() => {
    if (autoFocusedRow === null || !nameColId) return [];
    const query = String(rows[autoFocusedRow]?.[nameColId] || "").toLowerCase().trim();
    const results = query ? catalogItems.filter((i) => i.name.toLowerCase().includes(query) || (i.hsnCode && i.hsnCode.toLowerCase().includes(query))) : catalogItems;
    return results.slice(0, 10);
  }, [autoFocusedRow, rows, nameColId, catalogItems]);

  function applyCatalogItem(rowIndex: number, itemId: string) {
    const item = catalogItems.find((i) => i.id === itemId);
    if (!item || !selectedTemplate) return;
    const base = { ...rows[rowIndex] };
    if (nameColId) base[nameColId] = item.name;
    if (rateColId) base[rateColId] = Number(item.rate);
    if (qtyColId && (!base[qtyColId] || base[qtyColId] === 0)) base[qtyColId] = 1;
    if (hsnColId) base[hsnColId] = item.hsnCode ?? "";
    if (taxRateColId && item.taxRate !== null) base[taxRateColId] = Number(item.taxRate);
    base._hsnCode = item.hsnCode ?? "";
    const evaluatedRow = evaluateRow(base, selectedTemplate.columns);
    setRows((prev) => { const next = [...prev]; next[rowIndex] = evaluatedRow; return next; });
    if (item.taxRate !== null) setTaxPercent(Number(item.taxRate));
  }

  useEffect(() => { setDidAutoFocusRow(false); }, [selectedParty?.id, selectedTemplate?.id]);

  useEffect(() => {
    if (!selectedParty || !selectedTemplate || rows.length === 0 || didAutoFocusRow) return;
    const focusTimer = window.setTimeout(() => {
      const target = document.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>(
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
      showToast(t("bills.new.selectTemplateError" as TranslationKey), "error");
      mainScroll?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const formErrors: Record<string, boolean> = {};
    if (!selectedParty) formErrors.partyId = true;
    if (status === "FINAL" && !placeOfSupply) formErrors.placeOfSupply = true;
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      showToast(t("bills.new.validationError" as TranslationKey), "error");
      mainScroll?.scrollTo({ top: 0, behavior: "smooth" });
      window.setTimeout(() => setErrors({}), 3000);
      return;
    }
    const currentParty = selectedParty;
    if (!currentParty) { showToast(t("bills.new.selectPartyError" as TranslationKey), "error"); return; }
    setErrors({});
    setSavingAs(status);
    try {
      const payload = {
        templateId: selectedTemplate.id,
        partyId: currentParty.id,
        customerName: currentParty.name,
        customerPhone: currentParty.phone || null,
        customerAddress: currentParty.address || null,
        gstin: currentParty.gstin || null,
        rows, subtotal, taxPercent: uniqueTaxRate ?? 0, taxAmount, grandTotal: roundedGrandTotal, roundOff, isInterState, billDate,
        placeOfSupply: placeOfSupply || null,
        hsnCode: null,
        notes: notes.trim() || null,
        terms: terms.trim() || null,
        status,
      };
      const response = isEdit
        ? await fetch(`/api/bills/${editBillId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/bills", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      // [Phase 1 — Quota] 402 from /api/bills means monthly limit hit;
      // fire the global event so QuotaProvider shows the upgrade modal.
      if (response.status === 402) {
        const errData = await response.json().catch(() => ({}));
        if (errData?.code === "QUOTA_EXCEEDED" && errData.quota) {
          dispatchQuotaExceeded(errData.quota);
          return;
        }
      }
      if (!response.ok) throw new Error(await readError(response));
      const data = await response.json();
      showToast(status === "FINAL" ? t("bills.new.createSuccess" as TranslationKey) : t("bills.new.saveSuccess" as TranslationKey), "success");
      const targetId = isEdit ? editBillId : data.bill.id;

      if (status === "FINAL") {
        const elapsedMs = (typeof performance !== "undefined" ? performance.now() : Date.now()) - openedAtRef.current;
        const secondsToFinalize = elapsedMs / 1000;
        setFinalizeSeconds(secondsToFinalize);
        setBillFinalized(true);
        // Fire-and-forget — don't block navigation on telemetry
        fetch("/api/telemetry/bill-timing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secondsToFinalize, billId: targetId }),
        }).catch(() => undefined);
      }

      if (!tourMode || status !== "FINAL") {
        window.setTimeout(() => router.push(`/bills/${targetId}`), 700);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("bills.new.saveError" as TranslationKey), "error");
    } finally {
      setSavingAs(null);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: "var(--sb-bg)", minHeight: "100%", fontFamily: SG }}>
      {toast && <HKToast message={toast.message} type={toast.type} />}

      <div style={{ padding: isMobile ? "18px 14px 100px" : "24px 28px 60px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <button
            onClick={() => router.push("/bills")}
            style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              border: "1.5px solid var(--sb-border)",
              background: "var(--sb-card)", color: "var(--sb-text)",
              boxShadow: "var(--sb-shadow-card)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div>
            <h1 style={{ fontFamily: DISPLAY, fontSize: isMobile ? 24 : 30, fontWeight: 600, color: "var(--sb-text)", margin: 0, letterSpacing: "-0.01em", lineHeight: 1.2 }}>
              {isEdit ? t("bills.edit" as TranslationKey) : t("bills.new" as TranslationKey)}
            </h1>
            <p style={{ fontSize: 14, fontWeight: 500, color: "var(--sb-sub)", marginTop: 4 }}>
              {t("bills.new.subtitle" as TranslationKey)}
            </p>
          </div>
        </div>

        {/* ── Template picker ──────────────────────────────────────────────── */}
        {(templatePickerOpen || (!loading && !selectedTemplate && templates.length === 0)) && (
          <HKCard style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--sb-text)", fontFamily: SG }}>{t("bills.new.chooseTemplate" as TranslationKey)}</p>
              {templatePickerOpen && (
                <button
                  onClick={() => setTemplatePickerOpen(false)}
                  style={{ fontSize: TYPE.bodySmall, color: "var(--sb-sub)", background: "none", border: "none", cursor: "pointer", fontFamily: SG }}
                >
                  {t("common.cancel" as TranslationKey)}
                </button>
              )}
            </div>
            {loading ? (
              <p style={{ color: "var(--sb-sub)", fontSize: TYPE.body }}>{t("bills.new.loadingTemplates" as TranslationKey)}</p>
            ) : templates.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <p style={{ color: "var(--sb-sub)", marginBottom: 12, fontSize: TYPE.body }}>{t("bills.new.noTemplates" as TranslationKey)}</p>
                <HKButton onClick={() => router.push("/settings/templates/new")}>{t("bills.new.createTemplate" as TranslationKey)}</HKButton>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => selectTemplate(template.id)}
                    style={{
                      padding: "16px", borderRadius: 14,
                      border: "1.5px solid var(--sb-border)",
                      background: "var(--sb-card)", textAlign: "left",
                      cursor: "pointer", transition: "border-color 0.15s",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = PU; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--sb-border)"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: PU + "18", display: "flex", alignItems: "center", justifyContent: "center", color: PU }}>
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                           <path d="M9 12h6m-6 4h6M8 4h8a2 2 0 012 2v12a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2z" />
                        </svg>
                      </div>
                      <div>
                        <p style={{ fontSize: TYPE.body, fontWeight: 700, color: "var(--sb-text)", fontFamily: SG }}>{template.name}</p>
                        <p style={{ fontSize: TYPE.caption, color: "var(--sb-sub)", marginTop: 2 }}>{template.columns.length} {t("templates.columns" as TranslationKey)}</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {template.columns.map((col) => (
                        <span key={col.id} style={{
                          fontSize: 10, fontWeight: 600, fontFamily: SG,
                          padding: "2px 7px", borderRadius: 6,
                          background: col.type === "formula" ? AM + "18" : col.type === "number" ? PU + "18" : "var(--sb-badge)",
                          color: col.type === "formula" ? AM : col.type === "number" ? PU : "var(--sb-sub)",
                          border: `1px solid ${col.type === "formula" ? AM + "30" : col.type === "number" ? PU + "30" : "var(--sb-border)"}`,
                        }}>
                          {col.name}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </HKCard>
        )}

        {selectedTemplate && (
          <>
            {/* Active template indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{
                fontSize: TYPE.bodySmall, fontWeight: 700, fontFamily: SG,
                padding: "4px 12px", borderRadius: 20,
                background: C.primary + "18", color: C.primary,
                border: `1px solid ${C.primary}30`,
              }}>
                {selectedTemplate.name}
              </span>
              <button
                onClick={() => setTemplatePickerOpen(true)}
                style={{ fontSize: TYPE.bodySmall, color: "var(--sb-sub)", background: "none", border: "none", cursor: "pointer", fontFamily: SG, fontWeight: 600 }}
              >
                {t("bills.new.changeTemplate" as TranslationKey)}
              </button>
            </div>

            {/* ── Party / Bill To ────────────────────────────────────────── */}
            <Section title={t("bills.new.billTo" as TranslationKey)}>
              <div data-tour="party-search">
              <PartySearch
                value={selectedParty?.id || null}
                onChange={(party) => {
                  setSelectedParty(party);
                  if (party) {
                    setErrors((prev) => ({ ...prev, partyId: false }));
                    if (party.gstin) {
                      const stateCode = extractGstinStateCode(party.gstin);
                      if (stateCode && GST_STATE_CODES[stateCode]) setPlaceOfSupply(stateCode);
                      setIsInterState(deriveIsInterState(party.gstin, companyGstin));
                    } else {
                      setPlaceOfSupply("");
                      setIsInterState(false);
                    }
                  } else {
                    setPlaceOfSupply("");
                    setIsInterState(false);
                  }
                }}
                partyType="CUSTOMER"
                placeholder={t("bills.selectCustomer")}
                autoFocus={!selectedParty}
                isInvalid={Boolean(errors.partyId)}
              />

              {selectedParty && (
                <div style={{
                  marginTop: 14, padding: "14px 16px", borderRadius: 12,
                  background: "var(--sb-badge)", border: "1px solid var(--sb-border)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <p style={{ fontSize: TYPE.body, fontWeight: 700, color: "var(--sb-text)", fontFamily: SG }}>{selectedParty.name}</p>
                    <button
                      onClick={() => setSelectedParty(null)}
                      style={{ fontSize: TYPE.bodySmall, color: "var(--sb-sub)", background: "none", border: "none", cursor: "pointer", fontFamily: SG, fontWeight: 600 }}
                    >
                      {t("common.change")}
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {selectedParty.phone && (
                      <p style={{ fontSize: TYPE.bodySmall, color: "var(--sb-sub)", fontFamily: SG }}>📱 {selectedParty.phone}</p>
                    )}
                    {selectedParty.address && (
                      <p style={{ fontSize: TYPE.bodySmall, color: "var(--sb-sub)", fontFamily: SG }}>📍 {selectedParty.address}</p>
                    )}
                    {selectedParty.gstin && (
                      <p style={{ fontSize: TYPE.bodySmall, color: "var(--sb-sub)", fontFamily: IN }}>GST: {selectedParty.gstin}</p>
                    )}
                  </div>
                  {selectedParty.currentBalance !== 0 && (
                    <div style={{
                      marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--sb-border)",
                      fontSize: TYPE.bodySmall, fontWeight: 700, fontFamily: SG,
                      color: selectedParty.currentBalance < 0 ? GR : OR,
                      display: "flex", alignItems: "center", gap: 6,
                    }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: selectedParty.currentBalance < 0 ? GR : OR }} />
                      {selectedParty.currentBalance < 0
                        ? `${t("payments.toReceive" as TranslationKey)}: ${fmtFull(Math.abs(selectedParty.currentBalance))}`
                        : `${t("payments.toPay" as TranslationKey)}: ${fmtFull(selectedParty.currentBalance)}`}
                    </div>
                  )}
                </div>
              )}
              </div>
            </Section>

            {/* ── Line Items ──────────────────────────────────────────────── */}
            <div data-tour="line-items">
            <HKCard style={{ marginBottom: 16, padding: 0 }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "16px 20px 12px", borderBottom: "1px solid var(--sb-border)", flexWrap: "wrap", gap: 8,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--sb-text)", fontFamily: SG }}>{t("bills.new.lineItems" as TranslationKey)}</p>
                  <span style={{ fontSize: TYPE.bodySmall, color: "var(--sb-sub)", fontFamily: SG }}>
                    {t("bills.new.subtotal" as TranslationKey)}: <span style={{ fontFamily: IN, fontWeight: 700, color: "var(--sb-text)" }}>{formatCurrency(subtotal)}</span>
                  </span>
                  <span style={{ fontSize: TYPE.bodySmall, color: C.primary, fontFamily: SG }}>
                    {t("bills.new.grandTotal" as TranslationKey)}: <span style={{ fontFamily: IN, fontWeight: 800 }}>{formatCurrency(grandTotal)}</span>
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    onClick={addRow}
                    style={{
                      height: TOUCH.secondary, padding: "0 14px",
                      borderRadius: 10, border: "none",
                      background: C.primary, color: "#fff",
                      fontSize: TYPE.bodySmall, fontWeight: 700, fontFamily: SG,
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                    </svg>
                    {t("bills.new.addRow" as TranslationKey)}
                  </button>
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: TYPE.bodySmall, fontFamily: SG }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--sb-border)", background: "var(--sb-badge)" }}>
                      <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 600, color: "var(--sb-sub)", width: 40 }}>#</th>
                      {selectedTemplate.columns.map((column) => (
                        <th key={column.id} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "var(--sb-sub)", whiteSpace: "nowrap" }}>
                          {column.name}
                          {column.type === "formula" && <span style={{ color: AM, marginLeft: 4, fontSize: 10 }}>fx</span>}
                        </th>
                      ))}
                      <th style={{ width: 40 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, rowIndex) => (
                      <tr key={rowIndex} style={{ borderBottom: "1px solid var(--sb-border)" }}>
                        <td style={{ padding: "8px 12px", textAlign: "center", color: "var(--sb-sub)", fontSize: TYPE.bodySmall }}>{rowIndex + 1}</td>
                        {selectedTemplate.columns.map((column) => (
                          <td
                            key={column.id}
                            style={{ padding: "8px 8px" }}
                            data-bill-focus-target={rowIndex === 0 && column.id === firstEditableColumnId ? "true" : undefined}
                          >
                            {column.type === "formula" ? (
                              <span style={{ fontFamily: IN, fontWeight: 700, color: GR, fontSize: TYPE.bodySmall }}>
                                {typeof row[column.id] === "number" ? formatColumnValue(column.name, row[column.id] as number) : "—"}
                              </span>
                            ) : column.type === "number" ? (
                              <input
                                type="number"
                                aria-label={`Row ${rowIndex + 1} ${column.name}`}
                                value={String(row[column.id] || "")}
                                onChange={(e) => updateCell(rowIndex, column.id, e.target.value)}
                                style={{ minWidth: 80, background: "transparent", color: "var(--sb-text)", fontSize: TYPE.bodySmall, fontFamily: IN, outline: "none", border: "none", borderBottom: "1.5px solid var(--sb-border)", padding: "2px 0" }}
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
                                style={{ minWidth: 130, background: "transparent", color: "var(--sb-text)", fontSize: TYPE.bodySmall, fontFamily: SG, outline: "none", border: "none", borderBottom: "1.5px solid var(--sb-border)", padding: "2px 0" }}
                              />
                            ) : column.id === nameColId && catalogItems.length > 0 ? (
                              <div
                                ref={(el) => {
                                  if (el) nameInputRefs.current.set(rowIndex, el);
                                  else nameInputRefs.current.delete(rowIndex);
                                }}
                                style={{ minWidth: 160 }}
                              >
                                <input
                                  type="text"
                                  aria-label={`Row ${rowIndex + 1} ${column.name}`}
                                  value={String(row[column.id] || "")}
                                  onChange={(e) => updateCell(rowIndex, column.id, e.target.value)}
                                  onFocus={() => {
                                    setAutoFocusedRow(rowIndex);
                                    const el = nameInputRefs.current.get(rowIndex);
                                    if (el) {
                                      const rect = el.getBoundingClientRect();
                                      setDropdownRect({ top: rect.bottom + 4, left: rect.left, width: Math.max(260, rect.width) });
                                    }
                                  }}
                                  onBlur={() => window.setTimeout(() => setAutoFocusedRow((prev) => (prev === rowIndex ? null : prev)), 150)}
                                  placeholder={column.name}
                                  style={{ minWidth: 120, background: "transparent", color: "var(--sb-text)", fontSize: TYPE.bodySmall, fontFamily: SG, outline: "none", border: "none", borderBottom: "1.5px solid var(--sb-border)", padding: "2px 0" }}
                                />
                                {autoFocusedRow === rowIndex && autoFilteredItems.length > 0 && dropdownRect &&
                                  createPortal(
                                    <div style={{
                                      position: "fixed",
                                      top: dropdownRect.top,
                                      left: dropdownRect.left,
                                      width: dropdownRect.width,
                                      zIndex: 9999,
                                      borderRadius: 12,
                                      border: "1px solid var(--sb-border)",
                                      background: "var(--sb-card)",
                                      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                                      overflow: "hidden",
                                    }}>
                                      {autoFilteredItems.map((item) => (
                                        <button
                                          key={item.id}
                                          type="button"
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            applyCatalogItem(rowIndex, item.id);
                                            setAutoFocusedRow(null);
                                          }}
                                          style={{
                                            width: "100%", display: "flex", alignItems: "center",
                                            justifyContent: "space-between", gap: 8,
                                            padding: "10px 14px", textAlign: "left",
                                            background: "none", border: "none",
                                            borderBottom: "1px solid var(--sb-border)",
                                            cursor: "pointer", fontFamily: SG,
                                          }}
                                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--sb-badge)"; }}
                                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                                        >
                                          <div style={{ minWidth: 0 }}>
                                            <p style={{ fontSize: TYPE.bodySmall, fontWeight: 600, color: "var(--sb-text)", fontFamily: SG, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</p>
                                            {item.hsnCode && <p style={{ fontSize: TYPE.caption, color: "var(--sb-sub)" }}>HSN {item.hsnCode}</p>}
                                          </div>
                                          <span style={{ fontSize: TYPE.bodySmall, fontWeight: 700, color: PU, fontFamily: IN, flexShrink: 0 }}>
                                            ₹{Number(item.rate).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                          </span>
                                        </button>
                                      ))}
                                    </div>,
                                    document.body
                                  )
                                }
                              </div>
                            ) : (
                              <input
                                type="text"
                                aria-label={`Row ${rowIndex + 1} ${column.name}`}
                                value={String(row[column.id] || "")}
                                onChange={(e) => updateCell(rowIndex, column.id, e.target.value)}
                                style={{ minWidth: 120, background: "transparent", color: "var(--sb-text)", fontSize: TYPE.bodySmall, fontFamily: SG, outline: "none", border: "none", borderBottom: "1.5px solid var(--sb-border)", padding: "2px 0" }}
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
                              background: "transparent", color: rows.length <= 1 ? "var(--sb-border)" : OR,
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
            </div>

            {/* ── Notes + Summary ─────────────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 24 }}>
              {/* Notes */}
              <HKCard style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <HKTextarea
                  label={t("bills.new.notes" as TranslationKey)}
                  placeholder={t("bills.new.notes" as TranslationKey) + "..."}
                  value={notes}
                  onValueChange={setNotes}
                  minRows={2}
                />
                <HKTextarea
                  label={t("bills.new.terms" as TranslationKey)}
                  placeholder={t("bills.new.terms" as TranslationKey) + "..."}
                  value={terms}
                  onValueChange={setTerms}
                  minRows={3}
                />
              </HKCard>

              {/* Summary */}
              <HKCard style={{ background: C.primary + "08", border: `1px solid ${C.primary}20` }}>
                <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--sb-text)", fontFamily: SG, marginBottom: 16 }}>{t("bills.new.summary" as TranslationKey)}</p>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <span style={{ color: "var(--sb-sub)", fontSize: TYPE.body, fontFamily: SG, flexShrink: 0 }}>{t("bills.new.date" as TranslationKey)}</span>
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
                    <span style={{ color: "var(--sb-sub)", fontSize: TYPE.body, fontFamily: SG }}>{t("bills.new.subtotal" as TranslationKey)}</span>
                    <span style={{ fontFamily: IN, fontWeight: 600, color: "var(--sb-text)" }}>{formatCurrency(subtotal)}</span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--sb-sub)", fontSize: TYPE.body, fontFamily: SG }}>{taxLabelText}</span>
                    <span style={{ fontFamily: IN, fontWeight: 600, color: "var(--sb-text)" }}>{formatCurrency(taxAmount)}</span>
                  </div>

                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <p style={{ fontSize: TYPE.caption, color: "var(--sb-sub)", fontFamily: SG, flex: 1, margin: 0, paddingTop: 2 }}>{t("bills.autoTaxNote" as TranslationKey)}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      {gstIsLocked && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, fontFamily: SG,
                          padding: "2px 8px", borderRadius: 6,
                          background: isInterState ? AM + "20" : GR + "18",
                          color: isInterState ? AM : GR,
                          border: `1px solid ${isInterState ? AM + "40" : GR + "40"}`,
                        }}>
                          {isInterState ? "IGST" : "CGST + SGST"}
                        </span>
                      )}
                      <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: gstIsLocked ? "not-allowed" : "pointer", opacity: gstIsLocked ? 0.5 : 1 }}
                        title={gstIsLocked ? "Auto-detected from party GSTIN" : undefined}>
                        <input
                          type="checkbox"
                          checked={isInterState}
                          onChange={(e) => { if (!gstIsLocked) setIsInterState(e.target.checked); }}
                          disabled={gstIsLocked}
                          style={{ accentColor: PU }}
                        />
                        <span style={{ fontSize: TYPE.caption, color: "var(--sb-sub)", fontFamily: SG }}>{t("bills.new.interState" as TranslationKey)}</span>
                      </label>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: TYPE.bodySmall, color: "var(--sb-sub)", fontFamily: SG }}>{t("bills.new.placeOfSupply" as TranslationKey)}</span>
                      {gstIsLocked && (
                        <svg width="13" height="13" fill="none" stroke="var(--sb-sub)" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      )}
                    </div>
                    <HKSelect
                      aria-label="Place of supply"
                      placeholder={t("bills.new.selectState" as TranslationKey)}
                      size="sm"
                      value={placeOfSupply}
                      onValueChange={(v) => { setPlaceOfSupply(v ?? ""); if (v) setErrors((curr) => ({ ...curr, placeOfSupply: false })); }}
                      isDisabled={gstIsLocked}
                      isInvalid={Boolean(errors.placeOfSupply)}
                      errorMessage={errors.placeOfSupply ? t("bills.new.supplyRequired" as TranslationKey) : undefined}
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
                        style={{ accentColor: PU }}
                      />
                      <span style={{ fontSize: TYPE.caption, color: "var(--sb-sub)", fontFamily: SG }}>{t("bills.new.roundOff" as TranslationKey)}</span>
                    </label>
                    {enableRoundOff && roundOff !== 0 && (
                      <span style={{ fontSize: TYPE.bodySmall, fontFamily: IN, fontWeight: 600, color: roundOff > 0 ? GR : OR }}>
                        {roundOff > 0 ? "+" : ""}{formatCurrency(roundOff)}
                      </span>
                    )}
                  </div>

                  <div style={{ borderTop: "1px solid var(--sb-border)", paddingTop: 12, marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: TYPE.h2, fontWeight: 800, color: "var(--sb-text)", fontFamily: SG }}>{t("bills.new.grandTotal" as TranslationKey)}</span>
                    <span style={{ fontSize: TYPE.numMedium, fontWeight: 800, color: C.primary, fontFamily: IN }}>{formatCurrency(roundedGrandTotal)}</span>
                  </div>
                </div>
              </HKCard>
            </div>

            {/* ── Footer buttons ──────────────────────────────────────────── */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => router.push("/bills")}
                style={{
                  height: TOUCH.primary, padding: "0 20px",
                  borderRadius: 12, border: "1.5px solid var(--sb-border)",
                  background: "var(--sb-card)", color: "var(--sb-sub)",
                  fontSize: TYPE.body, fontWeight: 600, fontFamily: SG,
                  cursor: "pointer",
                }}
              >
                {t("common.cancel" as TranslationKey)}
              </button>
              <button
                onClick={() => handleSave("DRAFT")}
                disabled={savingAs === "FINAL"}
                style={{
                  height: TOUCH.primary, padding: "0 20px",
                  borderRadius: 12, border: "1.5px solid var(--sb-border)",
                  background: savingAs === "DRAFT" ? "var(--sb-badge)" : "var(--sb-card)",
                  color: "var(--sb-text)",
                  fontSize: TYPE.body, fontWeight: 600, fontFamily: SG,
                  cursor: savingAs === "FINAL" ? "not-allowed" : "pointer",
                  opacity: savingAs === "FINAL" ? 0.5 : 1,
                }}
              >
                {savingAs === "DRAFT" ? t("common.saving" as TranslationKey) : t("bills.saveDraft" as TranslationKey)}
              </button>
              <div data-tour="finalize-btn">
              <HKButton
                onClick={() => handleSave("FINAL")}
                isLoading={savingAs === "FINAL"}
                isDisabled={savingAs === "DRAFT"}
              >
                {t("bills.finalize" as TranslationKey)}
              </HKButton>
              </div>
            </div>
          </>
        )}
      </div>

      {tourMode && !tourDismissed && (
        <BillCreationTour
          onDismiss={() => setTourDismissed(true)}
          billFinalized={billFinalized}
          secondsToFinalize={finalizeSeconds}
          partySelected={!!selectedParty}
          hasItems={grandTotal > 0}
        />
      )}
    </div>
  );
}
