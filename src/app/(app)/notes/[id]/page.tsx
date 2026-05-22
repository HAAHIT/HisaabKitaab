"use client";

import { useState, useEffect, use } from "react";
import { HKSkeleton } from "@/components/ui/HKSkeleton";
import { useRouter } from "next/navigation";
import {
  GR, AM, OR, PU, SG, IN, TYPE,
  fmtFull, useIsMobile, HKCard, HKToast,
} from "@/components/ui/hk-design";

const ACCOUNT_LABELS: Record<string, string> = {
  SUNDRY_DEBTORS: "Sundry Debtors",
  SUNDRY_CREDITORS: "Sundry Creditors",
  SALES: "Sales",
  PURCHASE: "Purchase",
  CGST_OUTPUT: "Output CGST",
  SGST_OUTPUT: "Output SGST",
  IGST_OUTPUT: "Output IGST",
  CGST_INPUT: "Input CGST",
  SGST_INPUT: "Input SGST",
  IGST_INPUT: "Input IGST",
  ROUND_OFF: "Round Off",
};

interface NoteLine {
  id: string;
  accountCode: string;
  debit: number;
  credit: number;
  partyId: string | null;
  partyName: string | null;
}

interface NoteDetail {
  id: string;
  entryDate: string;
  narration: string;
  voucherType: "CREDIT_NOTE" | "DEBIT_NOTE";
  grandTotal: number;
  createdAt: string;
  createdBy: string;
  originalInvoiceNo: string | null;
  reasonForIssuance: string | null;
  partyId: string | null;
  partyName: string | null;
  lines: NoteLine[];
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function fmtINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

const PRINT_CSS = `
@media print {
  @page { margin: 10mm; size: A4 portrait; }
  html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
  .no-print { display: none !important; }
}
`;

export default function NoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const isMobile = useIsMobile();
  const [note, setNote] = useState<NoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    const el = document.createElement("style");
    el.setAttribute("data-sb-print", "1");
    el.textContent = PRINT_CSS;
    document.head.appendChild(el);
    return () => { document.head.removeChild(el); };
  }, []);

  useEffect(() => {
    fetch(`/api/credit-notes/${id}`)
      .then((r) => r.json())
      .then((d) => setNote(d.note))
      .catch(() => setToast({ message: "Note load karne mein problem", type: "error" }))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div style={{ background: "var(--sb-bg)", minHeight: "100%", fontFamily: SG }}>
        <div style={{ height: 57, borderBottom: "1px solid var(--sb-border)", background: "var(--sb-nav)" }} />
        <div style={{ padding: "24px 20px", maxWidth: 860, margin: "0 auto" }}>
          <HKSkeleton className="h-[500px] w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <div style={{ background: "var(--sb-bg)", minHeight: "100%", fontFamily: SG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
          <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--sb-text)", marginBottom: 8 }}>Note nahi mila</p>
          <button
            onClick={() => router.push("/notes")}
            style={{ marginTop: 16, padding: "10px 22px", borderRadius: 12, background: OR, color: "white", border: "none", fontFamily: SG, fontSize: TYPE.body, fontWeight: 700, cursor: "pointer" }}
          >
            Notes list par jao
          </button>
        </div>
      </div>
    );
  }

  const isCredit = note.voucherType === "CREDIT_NOTE";
  const accentColor = isCredit ? GR : AM;
  const accentBg = isCredit ? GR + "18" : AM + "18";

  const taxLines = note.lines.filter((l) =>
    l.accountCode.includes("CGST") || l.accountCode.includes("SGST") || l.accountCode.includes("IGST")
  );
  const revenueLines = note.lines.filter((l) => l.accountCode === "SALES" || l.accountCode === "PURCHASE");
  const subtotal = revenueLines.reduce((s, l) => s + l.debit + l.credit, 0);
  const totalTax = taxLines.reduce((s, l) => s + l.debit + l.credit, 0);

  const docLabel = isCredit ? "Credit Note" : "Debit Note";
  const docTitle = note.narration?.split(" against ")[0] || `Note #${note.id.slice(0, 8)}`;

  return (
    <div style={{ background: "var(--sb-bg)", minHeight: "100%", fontFamily: SG }}>
      {toast && <HKToast message={toast.message} type={toast.type} />}

      {/* Top bar */}
      <div
        className="no-print"
        style={{
          position: "sticky", top: 0, zIndex: 50,
          background: "var(--sb-nav)", borderBottom: "1px solid var(--sb-border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 20px", height: 57,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => router.push("/notes")}
            style={{
              width: 36, height: 36, borderRadius: 10, border: "1px solid var(--sb-border)",
              background: "var(--sb-card)", display: "flex", alignItems: "center",
              justifyContent: "center", cursor: "pointer",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--sb-text)" strokeWidth="2" strokeLinecap="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <div>
            <span style={{
              fontSize: TYPE.chip, fontWeight: 700, color: accentColor,
              background: accentBg, padding: "3px 9px", borderRadius: 6, marginRight: 8,
            }}>
              {docLabel}
            </span>
            <span style={{ fontSize: TYPE.bodySmall, color: "var(--sb-sub)", fontFamily: IN }}>
              {fmtDate(note.entryDate)}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => window.print()}
            style={{
              padding: "7px 16px", borderRadius: 10, border: "1px solid var(--sb-border)",
              background: "var(--sb-card)", color: "var(--sb-text)", fontFamily: SG,
              fontSize: TYPE.bodySmall, fontWeight: 600, cursor: "pointer",
            }}
          >
            Print
          </button>
        </div>
      </div>

      <div style={{ padding: isMobile ? "16px 14px" : "24px 28px", maxWidth: 860, margin: "0 auto" }}>

        {/* Header card */}
        <HKCard style={{ marginBottom: 16, borderLeft: `4px solid ${accentColor}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <span style={{
                  fontSize: TYPE.chip, fontWeight: 700, textTransform: "uppercase",
                  color: accentColor, background: accentBg, padding: "4px 10px", borderRadius: 7, letterSpacing: "0.5px",
                }}>
                  {docLabel}
                </span>
              </div>
              <h1 style={{ fontSize: isMobile ? TYPE.h1Mobile : TYPE.h1, fontWeight: 800, color: "var(--sb-text)", marginBottom: 4, fontFamily: IN }}>
                {docTitle}
              </h1>
              <p style={{ fontSize: TYPE.bodySmall, color: "var(--sb-sub)" }}>
                {fmtDate(note.entryDate)} · by {note.createdBy}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: TYPE.caption, color: "var(--sb-sub)", marginBottom: 4 }}>Grand Total</p>
              <p style={{ fontSize: TYPE.numLarge, fontWeight: 800, color: accentColor, fontFamily: IN }}>
                {isCredit ? `(${fmtINR(note.grandTotal)})` : `+${fmtINR(note.grandTotal)}`}
              </p>
            </div>
          </div>
        </HKCard>

        {/* Party + Reference row */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 16 }}>
          {/* Party */}
          <HKCard>
            <p style={{ fontSize: TYPE.caption, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--sb-sub)", marginBottom: 10 }}>
              {isCredit ? "Customer" : "Vendor"}
            </p>
            {note.partyName ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12, background: accentBg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, fontWeight: 800, color: accentColor,
                }}>
                  {note.partyName[0].toUpperCase()}
                </div>
                <div>
                  <p style={{ fontSize: TYPE.body, fontWeight: 700, color: "var(--sb-text)" }}>{note.partyName}</p>
                  {note.partyId && (
                    <button
                      className="no-print"
                      onClick={() => router.push(`/parties/${note.partyId}`)}
                      style={{
                        fontSize: TYPE.caption, color: accentColor, background: "transparent",
                        border: "none", cursor: "pointer", padding: 0, fontFamily: SG, marginTop: 2,
                      }}
                    >
                      Party profile dekho →
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p style={{ fontSize: TYPE.body, color: "var(--sb-sub)" }}>—</p>
            )}
          </HKCard>

          {/* Reference */}
          <HKCard>
            <p style={{ fontSize: TYPE.caption, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--sb-sub)", marginBottom: 10 }}>
              Reference
            </p>
            {note.originalInvoiceNo && (
              <div style={{ marginBottom: 8 }}>
                <p style={{ fontSize: TYPE.caption, color: "var(--sb-sub)" }}>Original Invoice</p>
                <p style={{ fontSize: TYPE.body, fontWeight: 700, color: "var(--sb-text)", fontFamily: IN }}>{note.originalInvoiceNo}</p>
              </div>
            )}
            {note.reasonForIssuance && (
              <div>
                <p style={{ fontSize: TYPE.caption, color: "var(--sb-sub)" }}>Reason</p>
                <span style={{
                  fontSize: TYPE.bodySmall, fontWeight: 600, color: accentColor,
                  background: accentBg, padding: "3px 9px", borderRadius: 7,
                }}>
                  {note.reasonForIssuance}
                </span>
              </div>
            )}
            {!note.originalInvoiceNo && !note.reasonForIssuance && (
              <p style={{ fontSize: TYPE.bodySmall, color: "var(--sb-sub)" }}>{note.narration}</p>
            )}
          </HKCard>
        </div>

        {/* Journal lines */}
        <HKCard style={{ marginBottom: 16 }}>
          <p style={{ fontSize: TYPE.label, fontWeight: 700, color: "var(--sb-text)", marginBottom: 16 }}>Journal Entries</p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ padding: "8px 10px", textAlign: "left", fontSize: TYPE.caption, fontWeight: 700, color: "var(--sb-sub)", borderBottom: "1px solid var(--sb-border)", textTransform: "uppercase", letterSpacing: "0.8px" }}>#</th>
                  <th style={{ padding: "8px 10px", textAlign: "left", fontSize: TYPE.caption, fontWeight: 700, color: "var(--sb-sub)", borderBottom: "1px solid var(--sb-border)", textTransform: "uppercase", letterSpacing: "0.8px" }}>Account</th>
                  <th style={{ padding: "8px 10px", textAlign: "right", fontSize: TYPE.caption, fontWeight: 700, color: "var(--sb-sub)", borderBottom: "1px solid var(--sb-border)", textTransform: "uppercase", letterSpacing: "0.8px" }}>Debit</th>
                  <th style={{ padding: "8px 10px", textAlign: "right", fontSize: TYPE.caption, fontWeight: 700, color: "var(--sb-sub)", borderBottom: "1px solid var(--sb-border)", textTransform: "uppercase", letterSpacing: "0.8px" }}>Credit</th>
                </tr>
              </thead>
              <tbody>
                {note.lines.map((line, i) => (
                  <tr key={line.id}>
                    <td style={{ padding: "10px", fontSize: TYPE.bodySmall, color: "var(--sb-sub)", borderBottom: "1px solid var(--sb-border)", width: 36 }}>{i + 1}</td>
                    <td style={{ padding: "10px", fontSize: TYPE.body, fontWeight: 600, color: "var(--sb-text)", borderBottom: "1px solid var(--sb-border)" }}>
                      {ACCOUNT_LABELS[line.accountCode] || line.accountCode}
                      {line.partyName && <span style={{ fontSize: TYPE.caption, color: "var(--sb-sub)", marginLeft: 8 }}>({line.partyName})</span>}
                    </td>
                    <td style={{ padding: "10px", textAlign: "right", fontFamily: IN, fontSize: TYPE.body, color: line.debit > 0 ? OR : "var(--sb-sub)", fontWeight: line.debit > 0 ? 700 : 400, borderBottom: "1px solid var(--sb-border)" }}>
                      {line.debit > 0 ? fmtINR(line.debit) : "—"}
                    </td>
                    <td style={{ padding: "10px", textAlign: "right", fontFamily: IN, fontSize: TYPE.body, color: line.credit > 0 ? GR : "var(--sb-sub)", fontWeight: line.credit > 0 ? 700 : 400, borderBottom: "1px solid var(--sb-border)" }}>
                      {line.credit > 0 ? fmtINR(line.credit) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </HKCard>

        {/* Summary */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 24 }}>
          {/* Balance effect */}
          <HKCard>
            <p style={{ fontSize: TYPE.label, fontWeight: 700, color: "var(--sb-text)", marginBottom: 12 }}>Balance Effect</p>
            <div style={{ padding: "14px 16px", borderRadius: 12, background: accentBg, border: `1px solid ${accentColor}33` }}>
              <p style={{ fontSize: TYPE.body, fontWeight: 700, color: accentColor }}>
                {isCredit ? "Balance kam hua by" : "Balance badhha by"} {fmtFull(note.grandTotal)}
              </p>
              <p style={{ fontSize: TYPE.bodySmall, color: "var(--sb-sub)", marginTop: 4 }}>
                {isCredit
                  ? "Customer ka outstanding balance reduce ho gaya."
                  : "Vendor ka outstanding balance increase ho gaya."}
              </p>
            </div>
          </HKCard>

          {/* Totals */}
          <HKCard>
            <p style={{ fontSize: TYPE.label, fontWeight: 700, color: "var(--sb-text)", marginBottom: 12 }}>Summary</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {subtotal > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: TYPE.bodySmall, color: "var(--sb-sub)" }}>Subtotal</span>
                  <span style={{ fontSize: TYPE.bodySmall, fontFamily: IN, fontWeight: 600, color: "var(--sb-text)" }}>{fmtINR(subtotal)}</span>
                </div>
              )}
              {taxLines.map((l, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: TYPE.bodySmall, color: "var(--sb-sub)" }}>{ACCOUNT_LABELS[l.accountCode] || l.accountCode}</span>
                  <span style={{ fontSize: TYPE.bodySmall, fontFamily: IN, fontWeight: 600, color: "var(--sb-text)" }}>{fmtINR(l.debit + l.credit)}</span>
                </div>
              ))}
              <div style={{ borderTop: "1px solid var(--sb-border)", paddingTop: 10, marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: TYPE.body, fontWeight: 700, color: "var(--sb-text)" }}>Grand Total</span>
                <span style={{ fontSize: TYPE.numMedium, fontWeight: 800, color: accentColor, fontFamily: IN }}>
                  {isCredit ? `(${fmtINR(note.grandTotal)})` : `+${fmtINR(note.grandTotal)}`}
                </span>
              </div>
            </div>
          </HKCard>
        </div>
      </div>

      {/* Print layout */}
      <div className="hidden print:block" style={{ padding: "8mm", color: "#000", fontSize: "10pt", fontFamily: "Arial, sans-serif" }}>
        <div style={{ borderBottom: "3px solid #000", paddingBottom: 12, marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "13pt", fontWeight: 800, border: `2px solid ${isCredit ? "#059669" : "#d97706"}`, color: isCredit ? "#059669" : "#d97706", padding: "4px 14px", display: "inline-block", letterSpacing: "2px", marginBottom: 6 }}>
              {isCredit ? "CREDIT MEMO" : "DEBIT MEMO"}
            </div>
            <p style={{ fontSize: "9pt", color: "#666", marginTop: 4 }}>{docTitle}</p>
          </div>
          <div style={{ textAlign: "right", fontSize: "9pt", lineHeight: "1.8" }}>
            <div><strong>Date:</strong> {fmtDate(note.entryDate)}</div>
            {note.originalInvoiceNo && <div><strong>Ref:</strong> {note.originalInvoiceNo}</div>}
            {note.reasonForIssuance && <div><strong>Reason:</strong> {note.reasonForIssuance}</div>}
          </div>
        </div>

        {note.partyName && (
          <div style={{ border: "1px solid #ccc", padding: "10px 14px", borderRadius: 4, marginBottom: 14, fontSize: "9pt" }}>
            <div style={{ fontSize: "7pt", fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4 }}>
              {isCredit ? "Customer" : "Vendor"}
            </div>
            <div style={{ fontSize: "12pt", fontWeight: 700 }}>{note.partyName}</div>
          </div>
        )}

        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 14, fontSize: "9pt" }}>
          <thead>
            <tr style={{ background: "#f5f5f5" }}>
              <th style={{ border: "1px solid #999", padding: "7px 6px", textAlign: "center", width: 30 }}>#</th>
              <th style={{ border: "1px solid #999", padding: "7px 6px", textAlign: "left" }}>Account</th>
              <th style={{ border: "1px solid #999", padding: "7px 6px", textAlign: "right" }}>Debit (₹)</th>
              <th style={{ border: "1px solid #999", padding: "7px 6px", textAlign: "right" }}>Credit (₹)</th>
            </tr>
          </thead>
          <tbody>
            {note.lines.map((line, i) => (
              <tr key={line.id}>
                <td style={{ border: "1px solid #ccc", padding: "6px", textAlign: "center", color: "#666" }}>{i + 1}</td>
                <td style={{ border: "1px solid #ccc", padding: "6px" }}>
                  {ACCOUNT_LABELS[line.accountCode] || line.accountCode}
                  {line.partyName && <span style={{ color: "#888", marginLeft: 6, fontSize: "8pt" }}>({line.partyName})</span>}
                </td>
                <td style={{ border: "1px solid #ccc", padding: "6px", textAlign: "right", fontFamily: "monospace" }}>{line.debit > 0 ? fmtINR(line.debit) : "—"}</td>
                <td style={{ border: "1px solid #ccc", padding: "6px", textAlign: "right", fontFamily: "monospace" }}>{line.credit > 0 ? fmtINR(line.credit) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <table style={{ width: "260px", borderCollapse: "collapse", fontSize: "9pt" }}>
            <tbody>
              {subtotal > 0 && (
                <tr>
                  <td style={{ padding: "5px 8px", borderBottom: "1px solid #eee" }}>Subtotal</td>
                  <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: "monospace", borderBottom: "1px solid #eee" }}>{fmtINR(subtotal)}</td>
                </tr>
              )}
              {taxLines.map((l, i) => (
                <tr key={i}>
                  <td style={{ padding: "5px 8px", borderBottom: "1px solid #eee", color: "#555" }}>{ACCOUNT_LABELS[l.accountCode] || l.accountCode}</td>
                  <td style={{ padding: "5px 8px", textAlign: "right", fontFamily: "monospace", borderBottom: "1px solid #eee" }}>{fmtINR(l.debit + l.credit)}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 800 }}>
                <td style={{ padding: "9px 8px", borderTop: `2px solid ${isCredit ? "#059669" : "#d97706"}`, fontSize: "11pt" }}>Grand Total</td>
                <td style={{ padding: "9px 8px", textAlign: "right", fontFamily: "monospace", borderTop: `2px solid ${isCredit ? "#059669" : "#d97706"}`, fontSize: "11pt", color: isCredit ? "#059669" : "#d97706" }}>
                  {isCredit ? `(${fmtINR(note.grandTotal)})` : `+${fmtINR(note.grandTotal)}`}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 36, textAlign: "right", paddingRight: 8 }}>
          <div style={{ borderBottom: "1px solid #999", width: 180, marginLeft: "auto", marginBottom: 6, height: 36 }} />
          <div style={{ fontSize: "7pt", fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "1px" }}>Authorized Signatory</div>
        </div>

        <div style={{ marginTop: 28, borderTop: "1px solid #ccc", paddingTop: 8, display: "flex", justifyContent: "space-between", fontSize: "7pt", color: "#aaa" }}>
          <div>Generated by SoloBooks</div>
          <div>Page 1 of 1</div>
        </div>
      </div>
    </div>
  );
}
