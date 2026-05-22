"use client";

import { useEffect, useState, useRef } from "react";
import { HKButton } from "@/components/ui/HKButton";
import { OR, PU, GR, AM, SG, IN, TYPE, PageHeader, useIsMobile } from "@/components/ui/hk-design";
import { SUPPORTED_BANKS } from "@/lib/bank-reconciliation/parsers/index";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BankAccount {
  id: string;
  name: string;
  type: string;
  accountNumber: string | null;
}

interface RowPreview {
  date: string;
  description: string;
  amount: number;
  direction: "INCOMING" | "OUTGOING";
  matchedPaymentId: string | null;
  confidence: number;
  reason: string;
}

interface UploadResult {
  statementId: string;
  rowCount: number;
  matchedCount: number;
  parseErrors: string[];
  preview: RowPreview[];
}

interface Statement {
  id: string;
  bankAccount: { name: string };
  periodFrom: string;
  periodTo: string;
  uploadedAt: string;
  rowCount: number;
  matchedCount: number;
  unmatchedCount: number;
  isReconciled: boolean;
}

type Step = "history" | "upload" | "preview" | "review" | "done";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReconcilePage() {
  const isMobile = useIsMobile();
  const [step, setStep] = useState<Step>("history");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Bank accounts
  const [accounts, setAccounts] = useState<BankAccount[]>([]);

  // Upload form state
  const [bankAccountId, setBankAccountId] = useState("");
  const [bankSlug, setBankSlug] = useState("GENERIC");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Upload result
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  // Review: track per-row manual overrides
  const [ignored, setIgnored] = useState<Set<string>>(new Set());

  // History
  const [statements, setStatements] = useState<Statement[]>([]);

  // Commit result
  const [commitResult, setCommitResult] = useState<{ matchedCount: number; ambiguousCount: number; totalRows: number } | null>(null);

  // ── Load bank accounts ───────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/bank-accounts")
      .then((r) => r.json())
      .then((d) => {
        if (d.accounts) setAccounts(d.accounts);
      })
      .catch(() => null);
  }, []);

  // ── Load statement history ───────────────────────────────────────────────

  function loadHistory() {
    setLoading(true);
    fetch("/api/reconcile/statements?limit=20")
      .then((r) => r.json())
      .then((d) => { if (d.statements) setStatements(d.statements); })
      .catch(() => null)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (step === "history") loadHistory();
  }, [step]);

  // ── Default period to current month ─────────────────────────────────────

  useEffect(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const last = new Date(y, today.getMonth() + 1, 0).getDate();
    setPeriodFrom(`${y}-${m}-01`);
    setPeriodTo(`${y}-${m}-${last}`);
  }, []);

  // ── Upload handler ───────────────────────────────────────────────────────

  async function handleUpload() {
    if (!bankAccountId) { showToast("Bank account select karo", false); return; }
    if (!fileRef.current?.files?.[0]) { showToast("CSV file choose karo", false); return; }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", fileRef.current.files[0]);
      fd.append("bankAccountId", bankAccountId);
      fd.append("bankSlug", bankSlug);
      fd.append("periodFrom", periodFrom);
      fd.append("periodTo", periodTo);

      const res = await fetch("/api/reconcile/upload", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) {
        showToast(data.error ?? "Upload failed", false);
        return;
      }

      setUploadResult(data as UploadResult);
      setIgnored(new Set());
      setStep("preview");
    } finally {
      setLoading(false);
    }
  }

  // ── Commit handler ───────────────────────────────────────────────────────

  async function handleCommit() {
    if (!uploadResult) return;
    setLoading(true);
    try {
      // First, mark user-ignored rows
      const ignorePromises = Array.from(ignored).map((matchedPaymentId) => {
        // Find row by matchedPaymentId in preview
        const row = uploadResult.preview.find((r) => r.matchedPaymentId === matchedPaymentId);
        if (!row) return Promise.resolve();
        return fetch("/api/reconcile/categorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rowId: matchedPaymentId, // this is a preview; we use statementId from upload result
            action: "IGNORE",
          }),
        });
      });
      await Promise.allSettled(ignorePromises);

      const res = await fetch("/api/reconcile/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statementId: uploadResult.statementId }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "Commit failed", false); return; }
      setCommitResult(data);
      setStep("done");
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: SG }}>
      {toast && (
        <div style={{
          position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)",
          background: toast.ok ? GR : "#e53e3e", color: "#fff",
          borderRadius: 12, padding: "12px 24px", fontSize: TYPE.body, fontFamily: SG,
          boxShadow: "0 4px 24px rgba(0,0,0,.18)", zIndex: 9999,
        }}>
          {toast.msg}
        </div>
      )}
      <PageHeader
        title="Bank Reconciliation"
        subtitle="Bank statement upload karo — payments se match karega"
        isMobile={isMobile}
      />

      {/* ── Step: History ──────────────────────────────────────────────────── */}
      {step === "history" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <p style={{ fontSize: TYPE.bodyLarge, fontWeight: 700, color: "var(--sb-text)", fontFamily: SG }}>
              Uploaded Statements
            </p>
            <HKButton
              onClick={() => setStep("upload")}
            >
              + Naya Statement
            </HKButton>
          </div>

          {loading && (
            <p style={{ color: "var(--sb-sub)", fontSize: TYPE.body, fontFamily: SG }}>Loading...</p>
          )}

          {!loading && statements.length === 0 && (
            <div style={{
              border: "2px dashed var(--sb-border)", borderRadius: 16, padding: 40,
              textAlign: "center",
            }}>
              <p style={{ fontSize: TYPE.bodyLarge, fontWeight: 700, color: "var(--sb-sub)", fontFamily: SG }}>
                Koi statement nahi mila
              </p>
              <p style={{ fontSize: TYPE.body, color: "var(--sb-sub)", marginTop: 8, fontFamily: SG }}>
                Pehla statement upload karo
              </p>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {statements.map((s) => (
              <div key={s.id} style={{
                border: "1.5px solid var(--sb-border)", borderRadius: 16, padding: "16px 20px",
                background: "var(--sb-card)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ fontSize: TYPE.bodyLarge, fontWeight: 700, color: "var(--sb-text)", fontFamily: SG, margin: 0 }}>
                      {s.bankAccount.name}
                    </p>
                    <p style={{ fontSize: TYPE.bodySmall, color: "var(--sb-sub)", fontFamily: SG, marginTop: 4 }}>
                      {fmtDate(s.periodFrom)} – {fmtDate(s.periodTo)}
                    </p>
                  </div>
                  <span style={{
                    padding: "4px 12px", borderRadius: 20, fontSize: TYPE.caption, fontWeight: 700,
                    background: s.isReconciled ? GR + "18" : AM + "18",
                    color: s.isReconciled ? GR : AM,
                    border: `1px solid ${s.isReconciled ? GR : AM}33`,
                    fontFamily: SG,
                  }}>
                    {s.isReconciled ? "Reconciled" : "Pending"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
                  {[
                    { l: "Total Rows", v: s.rowCount },
                    { l: "Matched", v: s.matchedCount, c: GR },
                    { l: "Unmatched", v: s.unmatchedCount, c: s.unmatchedCount > 0 ? AM : "var(--sb-sub)" },
                  ].map((stat) => (
                    <div key={stat.l}>
                      <p style={{ fontSize: TYPE.caption, color: "var(--sb-sub)", fontFamily: SG, margin: 0 }}>{stat.l}</p>
                      <p style={{ fontSize: TYPE.numMedium, fontWeight: 800, color: stat.c ?? "var(--sb-text)", fontFamily: IN, margin: 0 }}>
                        {stat.v}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Step: Upload Form ───────────────────────────────────────────────── */}
      {step === "upload" && (
        <div>
          <button
            onClick={() => setStep("history")}
            style={{ background: "none", border: "none", color: PU, fontSize: TYPE.body, fontFamily: SG, fontWeight: 600, cursor: "pointer", marginBottom: 20, padding: 0 }}
          >
            ← Wapas
          </button>

          <h2 style={{ fontSize: TYPE.h2, fontWeight: 800, color: "var(--sb-text)", fontFamily: SG, marginBottom: 24 }}>
            Statement Upload Karo
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Bank Account */}
            <div>
              <label style={{ display: "block", fontSize: TYPE.bodySmall, fontWeight: 700, color: "var(--sb-sub)", fontFamily: SG, marginBottom: 8 }}>
                Bank Account *
              </label>
              <select
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
                style={{
                  width: "100%", padding: "12px 16px", borderRadius: 12, fontSize: TYPE.body, fontFamily: SG,
                  border: "1.5px solid var(--sb-border)", background: "var(--sb-card)", color: "var(--sb-text)",
                  outline: "none",
                }}
              >
                <option value="">Select karo...</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}{a.accountNumber ? ` (${a.accountNumber})` : ""}</option>
                ))}
              </select>
            </div>

            {/* Bank Format */}
            <div>
              <label style={{ display: "block", fontSize: TYPE.bodySmall, fontWeight: 700, color: "var(--sb-sub)", fontFamily: SG, marginBottom: 8 }}>
                Bank Format *
              </label>
              <select
                value={bankSlug}
                onChange={(e) => setBankSlug(e.target.value)}
                style={{
                  width: "100%", padding: "12px 16px", borderRadius: 12, fontSize: TYPE.body, fontFamily: SG,
                  border: "1.5px solid var(--sb-border)", background: "var(--sb-card)", color: "var(--sb-text)",
                  outline: "none",
                }}
              >
                {SUPPORTED_BANKS.map((b) => (
                  <option key={b.slug} value={b.slug}>{b.label}</option>
                ))}
              </select>
            </div>

            {/* Period */}
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: TYPE.bodySmall, fontWeight: 700, color: "var(--sb-sub)", fontFamily: SG, marginBottom: 8 }}>
                  Period Se *
                </label>
                <input
                  type="date"
                  value={periodFrom}
                  onChange={(e) => setPeriodFrom(e.target.value)}
                  style={{
                    width: "100%", padding: "12px 16px", borderRadius: 12, fontSize: TYPE.body, fontFamily: SG,
                    border: "1.5px solid var(--sb-border)", background: "var(--sb-card)", color: "var(--sb-text)",
                    outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: TYPE.bodySmall, fontWeight: 700, color: "var(--sb-sub)", fontFamily: SG, marginBottom: 8 }}>
                  Period Tak *
                </label>
                <input
                  type="date"
                  value={periodTo}
                  onChange={(e) => setPeriodTo(e.target.value)}
                  style={{
                    width: "100%", padding: "12px 16px", borderRadius: 12, fontSize: TYPE.body, fontFamily: SG,
                    border: "1.5px solid var(--sb-border)", background: "var(--sb-card)", color: "var(--sb-text)",
                    outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            {/* File Upload */}
            <div>
              <label style={{ display: "block", fontSize: TYPE.bodySmall, fontWeight: 700, color: "var(--sb-sub)", fontFamily: SG, marginBottom: 8 }}>
                CSV File *
              </label>
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  border: "2px dashed var(--sb-border)", borderRadius: 12, padding: "24px 20px",
                  textAlign: "center", cursor: "pointer",
                  background: "var(--sb-bg)",
                }}
              >
                <p style={{ fontSize: TYPE.body, color: "var(--sb-sub)", fontFamily: SG, margin: 0 }}>
                  📂 CSV file tap karke choose karo
                </p>
                <p style={{ fontSize: TYPE.caption, color: "var(--sb-sub)", fontFamily: SG, marginTop: 4 }}>
                  Only .csv files supported
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: "none" }}
                onChange={() => {
                  const name = fileRef.current?.files?.[0]?.name;
                  if (name) showToast(`File ready: ${name}`, true);
                }}
              />
            </div>

            <HKButton
              fullWidth
              onClick={handleUpload}
              isLoading={loading}
            >
              Upload & Parse Karo
            </HKButton>
          </div>
        </div>
      )}

      {/* ── Step: Preview ───────────────────────────────────────────────────── */}
      {step === "preview" && uploadResult && (
        <div>
          <button
            onClick={() => setStep("upload")}
            style={{ background: "none", border: "none", color: PU, fontSize: TYPE.body, fontFamily: SG, fontWeight: 600, cursor: "pointer", marginBottom: 20, padding: 0 }}
          >
            ← Wapas
          </button>

          <h2 style={{ fontSize: TYPE.h2, fontWeight: 800, color: "var(--sb-text)", fontFamily: SG, marginBottom: 8 }}>
            Parse Preview
          </h2>

          {/* Summary chips */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
            {[
              { l: "Total", v: uploadResult.rowCount, c: PU },
              { l: "Auto Matched", v: uploadResult.matchedCount, c: GR },
              { l: "Unmatched", v: uploadResult.rowCount - uploadResult.matchedCount, c: AM },
            ].map((s) => (
              <div key={s.l} style={{
                padding: "8px 16px", borderRadius: 20, background: s.c + "18",
                border: `1px solid ${s.c}33`, display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ fontSize: TYPE.numMedium, fontWeight: 800, color: s.c, fontFamily: IN }}>{s.v}</span>
                <span style={{ fontSize: TYPE.caption, fontWeight: 700, color: s.c, fontFamily: SG }}>{s.l}</span>
              </div>
            ))}
          </div>

          {/* Parse errors */}
          {uploadResult.parseErrors.length > 0 && (
            <div style={{
              background: AM + "12", border: `1px solid ${AM}44`, borderRadius: 12,
              padding: "12px 16px", marginBottom: 16,
            }}>
              <p style={{ fontSize: TYPE.bodySmall, fontWeight: 700, color: AM, fontFamily: SG, margin: "0 0 6px" }}>
                ⚠️ {uploadResult.parseErrors.length} parse warning{uploadResult.parseErrors.length > 1 ? "s" : ""}
              </p>
              {uploadResult.parseErrors.slice(0, 5).map((e, i) => (
                <p key={i} style={{ fontSize: TYPE.caption, color: AM, fontFamily: SG, margin: "2px 0" }}>{e}</p>
              ))}
            </div>
          )}

          {/* Row table */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
            {uploadResult.preview.map((row, idx) => {
              const matched = !!row.matchedPaymentId && !ignored.has(row.matchedPaymentId);
              return (
                <div key={idx} style={{
                  border: `1.5px solid ${matched ? GR + "44" : "var(--sb-border)"}`,
                  borderRadius: 12, padding: "12px 16px",
                  background: matched ? GR + "08" : "var(--sb-card)",
                  display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: TYPE.bodySmall, fontWeight: 700, color: "var(--sb-text)", fontFamily: SG, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.description || "—"}
                    </p>
                    <p style={{ fontSize: TYPE.caption, color: "var(--sb-sub)", fontFamily: SG, marginTop: 2 }}>
                      {fmtDate(row.date)} · {row.direction === "INCOMING" ? "↓ Aaya" : "↑ Gaya"}
                    </p>
                    {matched && (
                      <p style={{ fontSize: TYPE.caption, color: GR, fontFamily: SG, marginTop: 2 }}>
                        ✓ {row.reason}
                      </p>
                    )}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ fontSize: TYPE.numMedium, fontWeight: 800, color: row.direction === "INCOMING" ? GR : OR, fontFamily: IN, margin: 0 }}>
                      {fmt.format(row.amount)}
                    </p>
                    {matched && row.matchedPaymentId && (
                      <button
                        onClick={() => setIgnored((prev) => new Set([...prev, row.matchedPaymentId!]))}
                        style={{ fontSize: TYPE.caption, color: "var(--sb-sub)", background: "none", border: "none", cursor: "pointer", fontFamily: SG, marginTop: 4 }}
                      >
                        Ignore
                      </button>
                    )}
                    {!matched && row.matchedPaymentId && ignored.has(row.matchedPaymentId) && (
                      <button
                        onClick={() => setIgnored((prev) => { const s = new Set(prev); s.delete(row.matchedPaymentId!); return s; })}
                        style={{ fontSize: TYPE.caption, color: PU, background: "none", border: "none", cursor: "pointer", fontFamily: SG, marginTop: 4 }}
                      >
                        Undo
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <HKButton
            fullWidth
            onClick={() => setStep("review")}
          >
            Review & Confirm Karo →
          </HKButton>
        </div>
      )}

      {/* ── Step: Review / Confirm ──────────────────────────────────────────── */}
      {step === "review" && uploadResult && (
        <div>
          <button
            onClick={() => setStep("preview")}
            style={{ background: "none", border: "none", color: PU, fontSize: TYPE.body, fontFamily: SG, fontWeight: 600, cursor: "pointer", marginBottom: 20, padding: 0 }}
          >
            ← Wapas
          </button>

          <h2 style={{ fontSize: TYPE.h2, fontWeight: 800, color: "var(--sb-text)", fontFamily: SG, marginBottom: 8 }}>
            Confirm Reconciliation
          </h2>
          <p style={{ fontSize: TYPE.body, color: "var(--sb-sub)", fontFamily: SG, marginBottom: 24 }}>
            Ek baar commit ho gaya toh statement lock ho jaayega.
          </p>

          <div style={{ border: "1.5px solid var(--sb-border)", borderRadius: 16, padding: 20, marginBottom: 24 }}>
            {[
              { l: "Total Rows", v: uploadResult.rowCount },
              { l: "Auto Matched", v: uploadResult.matchedCount - ignored.size, c: GR },
              { l: "Ignored / Unmatched", v: uploadResult.rowCount - uploadResult.matchedCount + ignored.size, c: AM },
            ].map((s) => (
              <div key={s.l} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--sb-border)" }}>
                <p style={{ fontSize: TYPE.body, color: "var(--sb-sub)", fontFamily: SG, margin: 0 }}>{s.l}</p>
                <p style={{ fontSize: TYPE.bodyLarge, fontWeight: 800, color: s.c ?? "var(--sb-text)", fontFamily: IN, margin: 0 }}>{s.v}</p>
              </div>
            ))}
          </div>

          <HKButton
            variant="success"
            fullWidth
            onClick={handleCommit}
            isLoading={loading}
          >
            Reconcile Commit Karo ✓
          </HKButton>
        </div>
      )}

      {/* ── Step: Done ───────────────────────────────────────────────────────── */}
      {step === "done" && commitResult && (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: TYPE.h1, fontWeight: 800, color: GR, fontFamily: SG, marginBottom: 8 }}>
            Reconciliation Ho Gayi!
          </h2>
          <p style={{ fontSize: TYPE.body, color: "var(--sb-sub)", fontFamily: SG, marginBottom: 24 }}>
            {commitResult.matchedCount} rows matched · {commitResult.ambiguousCount} ambiguous
          </p>
          <HKButton
            onClick={() => { setStep("history"); setUploadResult(null); setCommitResult(null); }}
          >
            History Dekho
          </HKButton>
        </div>
      )}
    </div>
  );
}
