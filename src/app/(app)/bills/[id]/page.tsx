"use client";

import { useState, useEffect, use } from "react";
import Image from "next/image";
import { HKModal } from "@/components/ui/hk-design";
import { HKSkeleton } from "@/components/ui/HKSkeleton";
import { useRouter } from "next/navigation";
import { BillActionBar } from "@/components/bills/BillActionBar";
import type { ColumnDef } from "@/lib/formula";
import { shareBill } from "@/lib/share";
import { GST_STATE_CODES } from "@/lib/gst-states";
import {
  OR, GR, AM, SG, IN, TYPE, TOUCH,
  HKToast, StatusChip,
} from "@/components/ui/hk-design";
import { HKButton } from "@/components/ui/HKButton";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BillDetail {
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
  terms: string | null;
  subtotal: number;
  taxPercent: number;
  taxAmount: number;
  grandTotal: number;
  roundOff?: number | null;
  placeOfSupply: string | null;
  hsnCode: string | null;
  status: string;
  date: string;
  createdAt: string;
  template: { name: string; columns: ColumnDef[] };
  creator: { name: string };
}

interface CompanySettings {
  companyName: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  companyGstin: string | null;
  companyLogo: string | null;
  upiId?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankBranch?: string | null;
  bankIfscCode?: string | null;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

const ONES = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
  "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
const TENS = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];

function w(n: number): string {
  if (!n) return "";
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n/10)] + (n%10 ? " " + ONES[n%10] : "");
  return ONES[Math.floor(n/100)] + " Hundred" + (n%100 ? " and " + w(n%100) : "");
}
function numberToWords(amount: number): string {
  const n = Math.round(amount);
  if (!n) return "Zero Rupees Only";
  const cr=Math.floor(n/1e7), lk=Math.floor((n%1e7)/1e5), th=Math.floor((n%1e5)/1e3), rm=n%1e3;
  return "Indian Rupees " +
    [(cr?w(cr)+" Crore ":""),(lk?w(lk)+" Lakh ":""),(th?w(th)+" Thousand ":""),(rm?w(rm):" ")].join("").trim() +
    " Only.";
}

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(n);
}
function formatVal(colName: string, value: number): string {
  const l = colName.toLowerCase();
  return (l.includes("rate")||l.includes("price")||l.includes("amount")||l.includes("total")||l.includes("₹")||l.includes("rs"))
    ? formatINR(value)
    : new Intl.NumberFormat("en-IN",{maximumFractionDigits:2}).format(value);
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN",{day:"2-digit",month:"2-digit",year:"numeric"});
}
function stateName(code: string|null) {
  if (!code) return "";
  return GST_STATE_CODES[code] ? `${GST_STATE_CODES[code]}` : code;
}

const PRINT_CSS = `
@media print {
  @page { margin: 8mm; size: A4 portrait; }
  html, body { margin: 0 !important; padding: 0 !important; background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .no-print { display: none !important; }
  .bill-bg { background: white !important; padding: 0 !important; min-height: 0 !important; }
  .bill-paper { box-shadow: none !important; border-radius: 0 !important; max-width: 100% !important; width: 100% !important; box-sizing: border-box !important; margin: 0 !important; }
  .main-content-area { padding: 0 !important; min-height: 0 !important; }
  .bill-pad-row { display: none !important; }
  .bill-paper table th { white-space: normal !important; }
}
`;

// ─── Component ────────────────────────────────────────────────────────────────

export default function BillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const [bill,          setBill]          = useState<BillDetail | null>(null);
  const [settings,      setSettings]      = useState<CompanySettings | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [toast,         setToast]         = useState<{ message: string; type: "success"|"error" }|null>(null);
  const [confirmAction, setConfirmAction] = useState<"FINAL"|"CANCELLED"|null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const el = document.createElement("style");
    el.setAttribute("data-hk-print", "1");
    el.textContent = PRINT_CSS;
    document.head.appendChild(el);
    return () => { document.head.removeChild(el); };
  }, []);

  function showToast(msg: string, type: "success"|"error") {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    (async () => {
      try {
        const [bRes, sRes] = await Promise.all([fetch(`/api/bills/${id}`), fetch("/api/settings")]);
        if (bRes.ok) setBill((await bRes.json()).bill);
        if (sRes.ok) setSettings((await sRes.json()).settings);
      } finally { setLoading(false); }
    })();
  }, [id]);

  async function execStatus(status: "FINAL"|"CANCELLED") {
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
          gstin: bill.gstin, rows: bill.rows, notes: bill.notes, terms: bill.terms,
          taxPercent: bill.taxPercent, subtotal: bill.subtotal,
          taxAmount: bill.taxAmount, grandTotal: bill.grandTotal,
          isInterState: bill.isInterState === true, status,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast(status === "FINAL" ? "Bill final ho gaya!" : "Bill cancel ho gaya", "success");
      setBill((await fetch(`/api/bills/${id}`).then(r => r.json())).bill);
    } catch (e) { showToast(e instanceof Error ? e.message : "Failed", "error"); }
    finally { setActionLoading(false); setConfirmAction(null); }
  }

  async function handleShare() {
    if (!bill || bill.status !== "FINAL") return;
    await shareBill({
      billNumber: bill.billNumber, customerName: bill.customerName,
      grandTotal: bill.grandTotal, customerPhone: bill.customerPhone,
      companyName: settings?.companyName || "My Business",
      companyUpiId: settings?.upiId || null,
      billUrl: `${window.location.origin}/bill/${bill.id}`,
    });
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ background: "var(--hk-bg)", minHeight: "100%", fontFamily: SG }}>
      <div style={{ height: 57, borderBottom: "1px solid var(--hk-border)", background: "var(--hk-nav)" }} />
      <div style={{ padding: "24px 20px", maxWidth: 860, margin: "0 auto" }}>
        <HKSkeleton className="h-[700px] w-full rounded-2xl" />
      </div>
    </div>
  );

  if (!bill) return (
    <div style={{ background: "var(--hk-bg)", minHeight: "100%", fontFamily: SG, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>📋</div>
        <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--hk-text)", marginBottom: 8 }}>Bill nahi mila</p>
        <p style={{ fontSize: TYPE.body, color: "var(--hk-sub)", marginBottom: 24 }}>Yeh bill exist nahi karta ya delete ho gaya</p>
        <HKButton onClick={() => router.push("/bills")}>Bills par wapas jao</HKButton>
      </div>
    </div>
  );

  // ── Derived ───────────────────────────────────────────────────────────────

  const cols     = bill.template.columns as ColumnDef[];
  const isIS     = bill.isInterState === true;
  const halfRate = bill.taxPercent / 2;
  const halfTax  = Math.round((bill.taxAmount / 2) * 100) / 100;
  const cgst     = halfTax;
  const sgst     = halfTax;
  const supply   = bill.placeOfSupply ? stateName(bill.placeOfSupply) : "";
  const supplyFull = bill.placeOfSupply ? `${supply} (${bill.placeOfSupply})` : "";

  const lastNumCol = [...cols].reverse().find(c => c.type === "formula" || c.type === "number");
  const numColCount = cols.filter(c => c.type === "number" || c.type === "formula").length;
  const templateHasHsnCol = cols.some(c => c.type === "text" && ["hsn","sac"].some(h => c.name.toLowerCase().includes(h)));

  const isMultiRate = (() => {
    const taxRateCol = cols.find(c => c.type === "number" && ["tax rate","tax%","gst rate","gst%"].some(h => c.name.toLowerCase().includes(h)));
    if (!taxRateCol) return false;
    const rates = (bill.rows as Record<string,string|number>[])
      .map(r => typeof r[taxRateCol.id] === "number" ? r[taxRateCol.id] as number : 0)
      .filter(r => r > 0);
    return new Set(rates).size > 1;
  })();

  const isVendor = bill.party?.type === "VENDOR";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {toast && <HKToast message={toast.message} type={toast.type} />}

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div
        className="no-print"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          borderBottom: "1px solid var(--hk-border)",
          background: "var(--hk-nav)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 16px" }}>
          {/* Left: back + bill number + status */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
            <button
              onClick={() => router.push(isVendor ? "/purchases" : "/bills")}
              style={{
                width: TOUCH.secondary, height: TOUCH.secondary,
                borderRadius: 10, border: "1.5px solid var(--hk-border)",
                background: "var(--hk-card)", color: "var(--hk-sub)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", flexShrink: 0,
              }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
            </button>
            <span style={{ fontSize: TYPE.body, fontWeight: 800, color: "var(--hk-text)", fontFamily: IN, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {bill.billNumber}
            </span>
            <StatusChip status={bill.status} />
            <span style={{ fontSize: TYPE.caption, color: "var(--hk-sub)", fontFamily: SG, whiteSpace: "nowrap", display: "none" }} className="sm-visible">
              {fmtDate(bill.createdAt)} · {bill.creator.name}
            </span>
          </div>

          {/* Right: actions */}
          <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
            <button
              onClick={() => window.print()}
              style={{
                height: TOUCH.secondary, padding: "0 14px",
                borderRadius: 10, border: "1.5px solid var(--hk-border)",
                background: "var(--hk-card)", color: "var(--hk-text)",
                fontSize: TYPE.bodySmall, fontWeight: 600, fontFamily: SG,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z" />
              </svg>
              Print
            </button>

            {bill.status === "DRAFT" && (
              <>
                <button
                  onClick={() => router.push(`/bills/${id}/edit`)}
                  style={{
                    height: TOUCH.secondary, padding: "0 14px",
                    borderRadius: 10, border: "1.5px solid var(--hk-border)",
                    background: "var(--hk-card)", color: "var(--hk-text)",
                    fontSize: TYPE.bodySmall, fontWeight: 600, fontFamily: SG,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Edit
                </button>
                <button
                  onClick={() => setConfirmAction("FINAL")}
                  style={{
                    height: TOUCH.secondary, padding: "0 14px",
                    borderRadius: 10, border: "none",
                    background: GR, color: "#fff",
                    fontSize: TYPE.bodySmall, fontWeight: 700, fontFamily: SG,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                    boxShadow: `0 3px 12px ${GR}40`,
                  }}
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                  Finalize
                </button>
              </>
            )}

            {bill.status !== "CANCELLED" && (
              <button
                onClick={() => setConfirmAction("CANCELLED")}
                style={{
                  height: TOUCH.secondary, padding: "0 14px",
                  borderRadius: 10, border: "1.5px solid var(--hk-border)",
                  background: "transparent", color: OR,
                  fontSize: TYPE.bodySmall, fontWeight: 600, fontFamily: SG,
                  cursor: "pointer", whiteSpace: "nowrap",
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Invoice document ──────────────────────────────────────────────────── */}
      <div className="bill-bg" style={{ minHeight: "100vh", padding: "24px 12px 120px", background: "var(--hk-bg)" }}>
        <div
          className="bill-paper"
          style={{
            maxWidth: 860,
            margin: "0 auto",
            background: "white",
            color: "#111",
            fontFamily: '"Arial","Helvetica",sans-serif',
            fontSize: 12,
            border: "1.5px solid #888",
            boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          }}
        >

          {/* ══ HEADER ════════════════════════════════════════════════════════ */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 14px", borderBottom:"1px solid #ccc", fontSize:10 }}>
            <span style={{ fontWeight:700, letterSpacing:1, textTransform:"uppercase", color:"#555" }}>Tax Invoice</span>
            <span style={{ color:"#555" }}>Subject to {supply || "local"} Jurisdiction</span>
          </div>

          <div style={{ textAlign:"center", padding:"14px 20px 10px", borderBottom:"1.5px solid #333" }}>
            {settings?.companyLogo && (
              <div style={{ marginBottom:8 }}>
                <Image src={settings.companyLogo} alt="Logo" width={80} height={80} unoptimized
                  style={{ height:60, width:"auto", objectFit:"contain", display:"inline-block" }} />
              </div>
            )}
            <div style={{ fontWeight:900, fontSize:28, letterSpacing:0.5, color:"#111", lineHeight:1 }}>
              {settings?.companyName || "—"}
            </div>
            {settings?.companyAddress && (
              <div style={{ fontSize:11, color:"#444", marginTop:5, lineHeight:1.4 }}>
                {settings.companyAddress.replace(/\n/g," · ")}
                {settings?.companyPhone ? `  ·  Mo: ${settings.companyPhone}` : ""}
                {settings?.companyEmail ? `  ·  ${settings.companyEmail}` : ""}
              </div>
            )}
            {settings?.companyGstin && (
              <div style={{ fontSize:11, fontWeight:700, marginTop:4, letterSpacing:0.5 }}>
                GST NO : {settings.companyGstin}
              </div>
            )}
          </div>

          {/* ══ PARTY + INVOICE META ══════════════════════════════════════════ */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", borderBottom:"1.5px solid #333" }}>
            <div style={{ padding:"10px 14px", borderRight:"1px solid #999", fontSize:11 }}>
              <div style={{ fontWeight:700, marginBottom:5, fontSize:11 }}>Party Name &amp; Address :</div>
              <div style={{ fontWeight:800, fontSize:13 }}>{bill.customerName}</div>
              {bill.customerAddress && (
                <div style={{ color:"#444", lineHeight:1.5, marginTop:3, whiteSpace:"pre-line" }}>{bill.customerAddress}</div>
              )}
              {bill.customerPhone && <div style={{ marginTop:3 }}>Ph: {bill.customerPhone}</div>}
              {bill.gstin && (
                <div style={{ marginTop:5, fontWeight:700 }}>GST No: <span style={{ fontFamily:"monospace" }}>{bill.gstin}</span></div>
              )}
              {bill.placeOfSupply && (
                <div style={{ marginTop:3, color:"#555" }}>
                  State: {supplyFull}
                  {" · "}
                  <span style={{ fontWeight:700, color: isIS ? "#b45309" : "#047857" }}>
                    {isIS ? "Inter-State" : "Intra-State"}
                  </span>
                </div>
              )}
            </div>

            <div style={{ padding:"10px 14px", fontSize:11 }}>
              {[
                ["Invoice No", bill.billNumber],
                ["Date", fmtDate(bill.date || bill.createdAt)],
                ...(bill.hsnCode ? [["HSN / SAC", bill.hsnCode]] : []),
                ...(bill.placeOfSupply ? [["Place of Supply", supplyFull]] : []),
                ...(bill.terms ? [["Payment Terms", bill.terms]] : []),
              ].map(([label, val]) => (
                <div key={label} style={{ display:"flex", gap:8, marginBottom:5, alignItems:"flex-start" }}>
                  <span style={{ minWidth:110, fontWeight:700, color:"#333" }}>{label}</span>
                  <span style={{ color:"#111" }}>: &nbsp;{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ══ ITEMS TABLE ═══════════════════════════════════════════════════ */}
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead>
              <tr style={{ background:"#f5f5f5", borderBottom:"1.5px solid #333", borderTop:"none" }}>
                <th style={TH({ w:32, center:true })}>S.No</th>
                {cols.map((col, i) => (
                  <th key={col.id} style={TH({ right: col.type==="number"||col.type==="formula", last: i===cols.length-1 })}>
                    {col.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(bill.rows as Record<string,string|number>[]).map((row, ri) => {
                const rowHsn = typeof row._hsnCode === "string" && row._hsnCode.trim() ? row._hsnCode.trim() : null;
                const firstTextColId = cols.find(c => c.type !== "number" && c.type !== "formula")?.id ?? null;
                return (
                  <tr key={ri} style={{ borderBottom:"1px solid #ddd" }}>
                    <td style={TD({ center:true, muted:true })}>{ri+1}</td>
                    {cols.map((col, ci) => (
                      <td key={col.id} style={TD({
                        right: col.type==="number"||col.type==="formula",
                        bold: col.type==="formula",
                        last: ci===cols.length-1,
                      })}>
                        {(col.type==="number"||col.type==="formula")
                          ? typeof row[col.id]==="number" ? formatVal(col.name, row[col.id] as number) : row[col.id]||"—"
                          : <>
                              {row[col.id]||"—"}
                              {rowHsn && col.id === firstTextColId && !templateHasHsnCol && (
                                <span style={{ display:"block", fontSize:9, color:"#888", marginTop:1 }}>
                                  HSN/SAC: {rowHsn}
                                </span>
                              )}
                            </>
                        }
                      </td>
                    ))}
                  </tr>
                );
              })}

              {(() => {
                const textCols = cols.length - numColCount;
                const spanLeft = 1 + textCols;
                const taxRows = isIS
                  ? [["IGST", isMultiRate ? "" : `@ ${bill.taxPercent}%`, formatINR(bill.taxAmount)]]
                  : [
                      ["OUTPUT CENTRAL GST", isMultiRate ? "(CGST)" : `(CGST) @ ${halfRate}%`, formatINR(cgst)],
                      ["OUTPUT STATE GST",   isMultiRate ? "(SGST)" : `(SGST) @ ${halfRate}%`, formatINR(sgst)],
                    ];
                return (
                  <>
                    <tr style={{ borderTop:"1.5px solid #555", borderBottom:"1px solid #ddd" }}>
                      <td colSpan={spanLeft} style={{ ...TD({}), borderRight:"1px solid #ccc" }}> </td>
                      {numColCount > 1 && Array.from({length:numColCount-1}).map((_,i) => (
                        <td key={i} style={{ ...TD({ right:true }), borderRight:"1px solid #ccc" }}> </td>
                      ))}
                      <td style={{ ...TD({ right:true, last:true, bold:false }), background:"#fafafa" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", gap:16 }}>
                          <span style={{ color:"#555", fontWeight:600 }}>Sub Total</span>
                          <span style={{ fontFamily:"monospace", fontWeight:700 }}>{formatINR(bill.subtotal)}</span>
                        </div>
                      </td>
                    </tr>
                    {taxRows.map(([label, rate, amt]) => (
                      <tr key={label} style={{ borderBottom:"1px solid #e5e5e5" }}>
                        <td colSpan={spanLeft} style={{ ...TD({}), borderRight:"1px solid #ccc" }}> </td>
                        {numColCount > 1 && Array.from({length:numColCount-1}).map((_,i) => (
                          <td key={i} style={{ ...TD({ right:true }), borderRight:"1px solid #ccc" }}> </td>
                        ))}
                        <td style={{ ...TD({ right:true, last:true }), background:"#fffbf5" }}>
                          <div style={{ display:"flex", justifyContent:"space-between", gap:16 }}>
                            <span style={{ color:"#6b4c00", fontSize:11, fontWeight:600 }}>{label} {rate}</span>
                            <span style={{ fontFamily:"monospace" }}>{amt}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {Number(bill.roundOff) !== 0 && (
                      <tr style={{ borderBottom:"1px solid #e5e5e5" }}>
                        <td colSpan={spanLeft} style={{ ...TD({}), borderRight:"1px solid #ccc" }}> </td>
                        {numColCount > 1 && Array.from({length:numColCount-1}).map((_,i) => (
                          <td key={i} style={{ ...TD({ right:true }), borderRight:"1px solid #ccc" }}> </td>
                        ))}
                        <td style={{ ...TD({ right:true, last:true }), background:"#fafafa" }}>
                          <div style={{ display:"flex", justifyContent:"space-between", gap:16 }}>
                            <span style={{ color:"#6b7280", fontSize:11, fontWeight:600 }}>Round Off</span>
                            <span style={{ fontFamily:"monospace", fontSize:11 }}>
                              ({Number(bill.roundOff) > 0 ? "+" : ""}{formatINR(Number(bill.roundOff))})
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })()}

              <tr style={{ background:"#1e3a5f", borderTop:"2px solid #1e3a5f" }}>
                <td colSpan={1} style={{ padding:"10px 10px", color:"white", fontWeight:900, fontSize:14, textAlign:"center", borderRight:"1px solid rgba(255,255,255,0.2)" }}>
                  Total
                </td>
                {cols.map((col, ci) => {
                  const isLast = ci===cols.length-1;
                  const isNum  = col.type==="number"||col.type==="formula";
                  const isLastVal = col === lastNumCol;
                  return (
                    <td key={col.id} style={{
                      padding:"10px 12px",
                      textAlign: isNum ? "right" : "left",
                      color:"white",
                      fontFamily: isNum ? "monospace" : "inherit",
                      fontWeight: isLastVal ? 900 : 400,
                      fontSize: isLastVal ? 16 : 13,
                      borderRight: isLast ? "none" : "1px solid rgba(255,255,255,0.2)",
                    }}>
                      {isLastVal ? formatINR(bill.grandTotal) : " "}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>

          {/* ══ AMOUNT IN WORDS ═══════════════════════════════════════════════ */}
          <div style={{ padding:"10px 14px", borderTop:"1.5px solid #333", borderBottom:"1px solid #ccc", fontSize:12 }}>
            <span style={{ fontWeight:700 }}>Rs. in words : </span>
            <span>{numberToWords(bill.grandTotal)}</span>
          </div>

          {(bill.notes || bill.terms) && (
            <div style={{ padding:"8px 14px", borderBottom:"1px solid #ccc", fontSize:11, color:"#444" }}>
              {bill.notes && <div><span style={{ fontWeight:700 }}>Declaration / Notes : </span>{bill.notes}</div>}
              {bill.terms && !bill.notes && <div><span style={{ fontWeight:700 }}>Terms : </span>{bill.terms}</div>}
            </div>
          )}

          {/* ══ FOOTER ════════════════════════════════════════════════════════ */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", borderTop:"1.5px solid #333" }}>
            <div style={{ padding:"12px 14px", borderRight:"1px solid #999", fontSize:11 }}>
              <div style={{ fontWeight:800, marginBottom:8, fontSize:12 }}>Company&apos;s Bank Details</div>
              {settings?.bankName || settings?.bankAccountNumber ? (
                <div style={{ lineHeight:1.8 }}>
                  {settings.bankName && <div><span style={{ fontWeight:700 }}>Bank Name :</span> {settings.bankName}</div>}
                  {settings.bankAccountNumber && <div><span style={{ fontWeight:700 }}>A/c Number :</span> <span style={{ fontFamily:"monospace" }}>{settings.bankAccountNumber}</span></div>}
                  {settings.bankBranch && <div><span style={{ fontWeight:700 }}>Branch :</span> {settings.bankBranch}</div>}
                  {settings.bankIfscCode && <div><span style={{ fontWeight:700 }}>IFSC Code :</span> <span style={{ fontFamily:"monospace" }}>{settings.bankIfscCode}</span></div>}
                  {settings.upiId && <div style={{ marginTop:4 }}><span style={{ fontWeight:700 }}>UPI ID :</span> {settings.upiId}</div>}
                </div>
              ) : settings?.upiId ? (
                <>
                  <div><span style={{ fontWeight:700 }}>UPI ID :</span> {settings.upiId}</div>
                  <div style={{ marginTop:4, fontSize:10, color:"#777" }}>Scan &amp; Pay via any UPI app</div>
                </>
              ) : (
                <div style={{ color:"#999", fontSize:10 }}>Contact us for payment details.</div>
              )}
            </div>

            <div style={{ padding:"12px 14px", fontSize:11 }}>
              <div style={{ fontWeight:800, marginBottom:32, textAlign:"right" }}>
                for {settings?.companyName || "—"}
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginTop:24 }}>
                <div style={{ textAlign:"center" }}>
                  <div style={{ width:110, borderTop:"1.5px solid #888", paddingTop:4, fontSize:10, color:"#666", textTransform:"uppercase", letterSpacing:0.5 }}>
                    Customer Seal &amp; Signature
                  </div>
                </div>
                <div style={{ textAlign:"center" }}>
                  <div style={{ width:110, borderTop:"1.5px solid #888", paddingTop:4, fontSize:10, color:"#666", textTransform:"uppercase", letterSpacing:0.5 }}>
                    Authorised Signatory
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ borderTop:"1px solid #ccc", padding:"6px 14px", background:"#f9f9f9", display:"flex", justifyContent:"space-between", fontSize:9, color:"#aaa", letterSpacing:0.3 }}>
            <span>E &amp; O.E.</span>
            <span>
              This is a computer-generated invoice by{" "}
              <strong style={{ color:"#777" }}>HisaabKitaab</strong>
              {" "}· No physical signature required
            </span>
          </div>

        </div>
      </div>

      {/* ── Action bar ───────────────────────────────────────────────────────── */}
      <BillActionBar
        bill={{ id:bill.id, billNumber:bill.billNumber, customerName:bill.customerName, grandTotal:bill.grandTotal, status:bill.status, customerPhone:bill.customerPhone, partyId:bill.partyId }}
        onShare={handleShare}
      />

      {/* ── Confirm modal ────────────────────────────────────────────────────── */}
      <HKModal
        isOpen={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        title={confirmAction === "FINAL" ? "Bill Final Karo?" : "Bill Cancel Karo?"}
        footer={
          <>
            <HKButton variant="secondary" onClick={() => setConfirmAction(null)}>
              Wapas jao
            </HKButton>
            <HKButton
              variant={confirmAction === "FINAL" ? "success" : "danger"}
              isLoading={actionLoading}
              onClick={() => confirmAction && execStatus(confirmAction)}
            >
              {confirmAction === "FINAL" ? "Haan, Finalize Karo" : "Haan, Cancel Karo"}
            </HKButton>
          </>
        }
      >
        <p style={{ fontFamily: SG, fontSize: TYPE.body, color: "var(--hk-sub)", lineHeight: 1.6 }}>
          {confirmAction === "FINAL"
            ? "Bill lock ho jayega aur books mein record ho jayega. Finalize karne ke baad edit nahi kar sakte."
            : "Bill permanently cancel ho jayega aur balance changes reverse ho jayenge."}
        </p>
      </HKModal>
    </>
  );
}

// ─── Table cell style helpers ─────────────────────────────────────────────────

function TH({ w: width, center, right, last }: { w?: number; center?: boolean; right?: boolean; last?: boolean }): React.CSSProperties {
  return {
    padding: "8px 12px",
    fontWeight: 700,
    fontSize: 11,
    color: "#222",
    textAlign: center ? "center" : right ? "right" : "left",
    borderBottom: "1.5px solid #333",
    borderRight: last ? "none" : "1px solid #ccc",
    background: "#f0f0f0",
    whiteSpace: "nowrap",
    ...(width ? { width } : {}),
  };
}

function TD({ center, right, bold, muted, last }: { center?: boolean; right?: boolean; bold?: boolean; muted?: boolean; last?: boolean }): React.CSSProperties {
  return {
    padding: "8px 12px",
    verticalAlign: "middle",
    textAlign: center ? "center" : right ? "right" : "left",
    fontFamily: right ? "monospace" : "inherit",
    fontWeight: bold ? 700 : 400,
    color: muted ? "#888" : "#111",
    borderRight: last ? "none" : "1px solid #ddd",
  };
}
