"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { type TranslationKey } from "@/lib/i18n/translations";
import type { ColumnDef } from "@/lib/formula";
import { GST_STATE_CODES } from "@/lib/gst-states";
import {
  OR, GR, AM, SG, IN, TYPE,
  HKCard, HKToast, HKModal, StatusChip, useIsMobile,
} from "@/components/ui/hk-design";
import { HKButton } from "@/components/ui/HKButton";
import { HKSkeleton } from "@/components/ui/HKSkeleton";
import { formatCurrency } from "@/lib/currency";

interface PurchaseDetail {
  id: string;
  billNumber: string;
  partyId: string | null;
  isInterState?: boolean;
  party: {
    id: string; name: string; type: "CUSTOMER" | "VENDOR";
    phone: string | null; address: string | null; gstin: string | null;
  } | null;
  customerName: string;
  customerPhone: string | null;
  customerAddress: string | null;
  gstin: string | null;
  rows: Record<string, string | number>[];
  notes: string | null;
  subtotal: number;
  taxPercent: number;
  taxAmount: number;
  grandTotal: number;
  roundOff?: number | null;
  placeOfSupply: string | null;
  status: string;
  date: string;
  createdAt: string;
  template: { name: string; columns: ColumnDef[] };
  creator: { name: string };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCellValue(colName: string, value: string | number): string {
  if (typeof value === "number") {
    const l = colName.toLowerCase();
    const isCurrency = l.includes("rate") || l.includes("price") || l.includes("amount") || l.includes("total") || l.includes("rs");
    if (isCurrency) return formatCurrency(value);
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
  }
  return String(value || "");
}

const PRINT_CSS = `
@media print {
  @page { margin: 12mm; size: A4 portrait; }
  html, body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .no-print { display: none !important; }
  .pur-bg { background: white !important; padding: 0 !important; }
  .pur-card { box-shadow: none !important; border: 1px solid #ddd !important; break-inside: avoid; }
}
`;

export default function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { t } = useLanguage();
  const { id } = use(params);
  const isMobile = useIsMobile();

  const [bill, setBill] = useState<PurchaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [confirmAction, setConfirmAction] = useState<"FINAL" | "CANCELLED" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = PRINT_CSS;
    document.head.appendChild(el);
    return () => { document.head.removeChild(el); };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/bills/${id}`);
        if (res.ok) setBill((await res.json()).bill);
      } finally { setLoading(false); }
    })();
  }, [id]);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function execStatus(status: "FINAL" | "CANCELLED") {
    if (!bill) return;
    setActionLoading(true);
    try {
      const del = status === "CANCELLED";
      const res = await fetch(`/api/bills/${id}`, {
        method: del ? "DELETE" : "PATCH",
        headers: del ? {} : { "Content-Type": "application/json" },
        body: del ? undefined : JSON.stringify({
          partyId: bill.partyId, customerName: bill.customerName,
          customerPhone: bill.customerPhone, customerAddress: bill.customerAddress,
          gstin: bill.gstin, rows: bill.rows, notes: bill.notes,
          taxPercent: bill.taxPercent, subtotal: bill.subtotal,
          taxAmount: bill.taxAmount, grandTotal: bill.grandTotal,
          isInterState: bill.isInterState === true, status,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast(status === "FINAL" ? t("bills.detail.finalizeSuccess" as TranslationKey) : t("bills.detail.cancelSuccess" as TranslationKey), "success");
      const fresh = await fetch(`/api/bills/${id}`);
      if (fresh.ok) setBill((await fresh.json()).bill);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: isMobile ? "20px 14px" : "24px 28px", maxWidth: 900, margin: "0 auto" }}>
        <HKSkeleton className="h-10 w-60 rounded-2xl mb-4" />
        <HKSkeleton className="h-[600px] w-full rounded-2xl" />
      </div>
    );
  }

  if (!bill) {
    return (
      <div style={{ background: "var(--sb-bg)", minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 40, fontFamily: SG }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--sb-text)", marginBottom: 8 }}>{t("bills.detail.notFound" as TranslationKey)}</p>
          <HKButton onClick={() => router.push("/purchases")}>{t("purchases.pageTitle" as TranslationKey)}</HKButton>
        </div>
      </div>
    );
  }

  const cols = bill.template.columns as ColumnDef[];
  const isIS = bill.isInterState === true;
  const halfTax = Math.round((bill.taxAmount / 2) * 100) / 100;
  const supply = bill.placeOfSupply ? GST_STATE_CODES[bill.placeOfSupply] : "";
  const supplyFull = bill.placeOfSupply ? `${supply} (${bill.placeOfSupply})` : "—";
  const supplierName = bill.party?.name || bill.customerName;
  const supplierPhone = bill.party?.phone || bill.customerPhone;
  const supplierAddress = bill.party?.address || bill.customerAddress;
  const supplierGstin = bill.party?.gstin || bill.gstin;

  return (
    <>
      {toast && <HKToast message={toast.message} type={toast.type} />}

      <div className="pur-bg" style={{ background: "var(--sb-bg)", minHeight: "100%", fontFamily: SG }}>
        <div style={{ padding: isMobile ? "18px 14px 100px" : "24px 28px 60px", maxWidth: 1000, margin: "0 auto" }}>
          <div className="no-print" style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 14, marginBottom: 18, flexWrap: "wrap" }}>
            <button
              onClick={() => router.push("/purchases")}
              style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                border: "1.5px solid var(--sb-border)",
                background: "var(--sb-card)", color: "var(--sb-text)",
                boxShadow: "var(--sb-shadow-card)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}
              aria-label="Back"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontFamily: SG, fontSize: isMobile ? 22 : 28, fontWeight: 700, color: "var(--sb-text)", margin: 0, letterSpacing: "-0.01em", lineHeight: 1.2 }}>
                {t("purchases.detail.title" as TranslationKey)}
              </h1>
              <p style={{ fontSize: 14, fontWeight: 500, color: "var(--sb-sub)", margin: "4px 0 0" }}>
                {bill.billNumber} · {fmtDate(bill.date ?? bill.createdAt)}
              </p>
            </div>
            <div style={{ display: "flex", gap: isMobile ? 6 : 8, alignItems: "center", flexWrap: "wrap", width: isMobile ? "100%" : "auto", justifyContent: isMobile ? "flex-end" : "flex-start" }}>
                  <button
                    onClick={() => window.print()}
                    aria-label={t("common.print" as TranslationKey)}
                    style={{
                      height: isMobile ? 36 : 40, padding: isMobile ? "0 10px" : "0 14px", borderRadius: 12,
                      border: "1.5px solid var(--sb-border)",
                      background: "var(--sb-card)", color: "var(--sb-text)",
                      fontSize: TYPE.bodySmall, fontWeight: 600, fontFamily: SG,
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z" />
                    </svg>
                    {!isMobile && t("common.print" as TranslationKey)}
                  </button>
                  {bill.status === "DRAFT" && (
                    <>
                      <button
                        onClick={() => router.push(`/bills/${id}/edit`)}
                        style={{
                          height: isMobile ? 36 : 40, padding: isMobile ? "0 12px" : "0 14px", borderRadius: 12,
                          border: "1.5px solid var(--sb-border)",
                          background: "var(--sb-card)", color: "var(--sb-text)",
                          fontSize: TYPE.bodySmall, fontWeight: 600, fontFamily: SG,
                          cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                        }}
                      >
                        {t("templates.edit" as TranslationKey)}
                      </button>
                      <button
                        onClick={() => setConfirmAction("FINAL")}
                        style={{
                          height: isMobile ? 36 : 40, padding: isMobile ? "0 12px" : "0 14px", borderRadius: 12, border: "none",
                          background: GR, color: "#fff",
                          fontSize: TYPE.bodySmall, fontWeight: 700, fontFamily: SG,
                          cursor: "pointer", boxShadow: `0 3px 12px ${GR}40`,
                        }}
                      >
                        {t("bills.finalize" as TranslationKey)}
                      </button>
                    </>
                  )}
                  {bill.status !== "CANCELLED" && (
                    <button
                      onClick={() => setConfirmAction("CANCELLED")}
                      style={{
                        height: isMobile ? 36 : 40, padding: isMobile ? "0 12px" : "0 14px", borderRadius: 12,
                        border: "1.5px solid var(--sb-border)",
                        background: "transparent", color: OR,
                        fontSize: TYPE.bodySmall, fontWeight: 600, fontFamily: SG,
                        cursor: "pointer",
                      }}
                    >
                      {t("common.cancel" as TranslationKey)}
                    </button>
                  )}
            </div>
          </div>

          {/* Header card: status + identifiers */}
          <HKCard className="pur-card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
              <div>
                <p style={{ fontSize: TYPE.caption, color: "var(--sb-sub)", fontFamily: SG, margin: 0, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  {t("purchases.detail.recordTitle" as TranslationKey)}
                </p>
                <p style={{ fontSize: TYPE.h1, fontWeight: 800, color: "var(--sb-text)", fontFamily: IN, margin: "4px 0 0" }}>
                  {bill.billNumber}
                </p>
              </div>
              <StatusChip status={bill.status} />
            </div>
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 16 }}>
              <Field label={t("purchases.detail.billDate" as TranslationKey)} value={fmtDate(bill.date ?? bill.createdAt)} />
              <Field label={t("purchases.detail.placeOfSupply" as TranslationKey)} value={supplyFull} />
              <Field label={t("purchases.detail.taxType" as TranslationKey)} value={isIS ? "IGST (Inter-state)" : "CGST + SGST"} />
              <Field label={t("purchases.detail.createdBy" as TranslationKey)} value={bill.creator.name} />
            </div>
          </HKCard>

          {/* Supplier card */}
          <HKCard className="pur-card" style={{ marginBottom: 16 }}>
            <p style={{ fontSize: TYPE.caption, color: "var(--sb-sub)", fontFamily: SG, margin: 0, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
              {t("purchases.detail.supplier" as TranslationKey)}
            </p>
            <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--sb-text)", fontFamily: SG, margin: 0 }}>
              {supplierName}
            </p>
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
              {supplierGstin && <Field label={t("purchases.detail.gstin" as TranslationKey)} value={supplierGstin} mono />}
              {supplierPhone && <Field label={t("purchases.detail.phone" as TranslationKey)} value={supplierPhone} />}
              {supplierAddress && <Field label={t("purchases.detail.address" as TranslationKey)} value={supplierAddress} full />}
            </div>
          </HKCard>

          {/* Line items */}
          <HKCard className="pur-card" style={{ marginBottom: 16, padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--sb-border)" }}>
              <p style={{ fontSize: TYPE.caption, color: "var(--sb-sub)", fontFamily: SG, margin: 0, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                {t("purchases.detail.lineItems" as TranslationKey)}
              </p>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: TYPE.bodySmall, fontFamily: SG }}>
                <thead>
                  <tr style={{ background: "var(--sb-badge)", borderBottom: "1px solid var(--sb-border)" }}>
                    <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 600, color: "var(--sb-sub)", width: 40 }}>#</th>
                    {cols.map((col) => (
                      <th key={col.id} style={{ padding: "10px 12px", textAlign: col.type === "number" || col.type === "formula" ? "right" : "left", fontWeight: 600, color: "var(--sb-sub)", whiteSpace: "nowrap" }}>
                        {col.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bill.rows.map((row, rIdx) => (
                    <tr key={rIdx} style={{ borderBottom: "1px solid var(--sb-border)" }}>
                      <td style={{ padding: "10px 12px", textAlign: "center", color: "var(--sb-sub)" }}>{rIdx + 1}</td>
                      {cols.map((col) => {
                        const isNum = col.type === "number" || col.type === "formula";
                        return (
                          <td key={col.id} style={{ padding: "10px 12px", textAlign: isNum ? "right" : "left", fontFamily: isNum ? IN : SG, fontWeight: isNum ? 600 : 400, color: "var(--sb-text)" }}>
                            {formatCellValue(col.name, row[col.id])}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </HKCard>

          {/* Totals + Notes */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <HKCard className="pur-card">
              <p style={{ fontSize: TYPE.caption, color: "var(--sb-sub)", fontFamily: SG, margin: 0, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
                {t("purchases.detail.notes" as TranslationKey)}
              </p>
              <p style={{ fontSize: TYPE.body, color: "var(--sb-text)", fontFamily: SG, margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                {bill.notes || "—"}
              </p>
            </HKCard>

            <HKCard className="pur-card" style={{ background: AM + "08", border: `1px solid ${AM}20` }}>
              <p style={{ fontSize: TYPE.caption, color: "var(--sb-sub)", fontFamily: SG, margin: 0, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
                {t("purchases.detail.amounts" as TranslationKey)}
              </p>
              <Row label={t("bills.new.subtotal" as TranslationKey)} value={formatCurrency(bill.subtotal)} />
              {isIS ? (
                <Row label={`IGST @ ${bill.taxPercent}%`} value={formatCurrency(bill.taxAmount)} />
              ) : (
                <>
                  <Row label={`CGST @ ${bill.taxPercent / 2}%`} value={formatCurrency(halfTax)} />
                  <Row label={`SGST @ ${bill.taxPercent / 2}%`} value={formatCurrency(halfTax)} />
                </>
              )}
              {bill.roundOff != null && Number(bill.roundOff) !== 0 && (
                <Row label={t("bills.new.roundOff" as TranslationKey)} value={`${Number(bill.roundOff) > 0 ? "+" : ""}${formatCurrency(Number(bill.roundOff))}`} />
              )}
              <div style={{ height: 1, background: "var(--sb-border)", margin: "10px 0" }} />
              <Row label={t("bills.new.grandTotal" as TranslationKey)} value={formatCurrency(bill.grandTotal)} emphasize />
            </HKCard>
          </div>
        </div>

        {confirmAction && (
          <HKModal
            isOpen
            onClose={() => setConfirmAction(null)}
            title={confirmAction === "FINAL" ? t("bills.detail.finalizeConfirmTitle" as TranslationKey) : t("bills.detail.cancelConfirmTitle" as TranslationKey)}
          >
            <div style={{ padding: 20, fontFamily: SG }}>
              <p style={{ fontSize: TYPE.body, color: "var(--sb-sub)", margin: "0 0 16px" }}>
                {confirmAction === "FINAL" ? t("bills.detail.finalizeConfirmDesc" as TranslationKey) : t("bills.detail.cancelConfirmDesc" as TranslationKey)}
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <HKButton variant="secondary" onClick={() => setConfirmAction(null)} isDisabled={actionLoading}>
                  {t("common.cancel" as TranslationKey)}
                </HKButton>
                <HKButton onClick={() => execStatus(confirmAction)} isLoading={actionLoading}>
                  {t("common.confirm" as TranslationKey)}
                </HKButton>
              </div>
            </div>
          </HKModal>
        )}
      </div>
    </>
  );
}

function Field({ label, value, mono, full }: { label: string; value: string; mono?: boolean; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : undefined }}>
      <p style={{ fontSize: TYPE.caption, color: "var(--sb-sub)", fontFamily: SG, margin: 0, marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: TYPE.body, color: "var(--sb-text)", fontFamily: mono ? IN : SG, fontWeight: 600, margin: 0, wordBreak: "break-word" }}>{value}</p>
    </div>
  );
}

function Row({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
      <span style={{ fontSize: emphasize ? TYPE.body : TYPE.bodySmall, color: emphasize ? "var(--sb-text)" : "var(--sb-sub)", fontFamily: SG, fontWeight: emphasize ? 700 : 500 }}>{label}</span>
      <span style={{ fontSize: emphasize ? TYPE.numMedium : TYPE.body, color: emphasize ? AM : "var(--sb-text)", fontFamily: IN, fontWeight: emphasize ? 800 : 600 }}>{value}</span>
    </div>
  );
}
