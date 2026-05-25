"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  C, GR, OR, SG, IN, TYPE, HKCard, HKSkeleton, fmtFull, useIsMobile,
  PageHeader,
} from "@/components/ui/hk-design";
import { HKButton } from "@/components/ui/HKButton";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  tallyGroup: string;
  type: string;
  totalDebit: number;
  totalCredit: number;
  closingDebit: number;
  closingCredit: number;
}

interface TrialBalanceReport {
  from: string;
  to: string;
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

interface Party {
  id: string;
  name: string;
  type: string;
  currentBalance: number;
  phone?: string | null;
  gstin?: string | null;
}

interface JournalEntry {
  id: string;
  voucherType: string;
  entryDate: string;
  narration: string | null;
  totalDebit: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function inr(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function getIstDateRange(): { from: string; to: string } {
  const now = new Date();
  const ist = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [y, m] = ist.split("-").map(Number);
  const fyStart = m >= 4 ? `${y}-04-01` : `${y - 1}-04-01`;
  return { from: fyStart, to: ist };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CaPortalPage() {
  const router = useRouter();
  const isMobile = useIsMobile();

  const [tab, setTab] = useState<"trial-balance" | "ledger" | "journals">("trial-balance");
  const [trialBalance, setTrialBalance] = useState<TrialBalanceReport | null>(null);
  const [tbLoading, setTbLoading] = useState(false);
  const [tbError, setTbError] = useState<string | null>(null);

  const [parties, setParties] = useState<Party[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);

  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalError, setJournalError] = useState<string | null>(null);

  const [roleError, setRoleError] = useState(false);

  const { from, to } = getIstDateRange();

  const loadTrialBalance = useCallback(async () => {
    setTbLoading(true);
    setTbError(null);
    try {
      const res = await fetch(`/api/reports/trial-balance?from=${from}&to=${to}`);
      if (res.status === 403) { setRoleError(true); return; }
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load");
      setTrialBalance(json.data);
    } catch (err) {
      setTbError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setTbLoading(false);
    }
  }, [from, to]);

  const loadLedger = useCallback(async () => {
    setLedgerLoading(true);
    setLedgerError(null);
    try {
      const res = await fetch("/api/parties?limit=100&sortBy=name");
      if (res.status === 403) { setRoleError(true); return; }
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load");
      setParties(json.parties || []);
    } catch (err) {
      setLedgerError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLedgerLoading(false);
    }
  }, []);

  const loadJournals = useCallback(async () => {
    setJournalLoading(true);
    setJournalError(null);
    try {
      const res = await fetch(`/api/export/transactions?from=${from}&to=${to}&format=json`);
      if (res.status === 403) { setRoleError(true); return; }
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to load");
      setJournals(json.entries || []);
    } catch (err) {
      setJournalError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setJournalLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    if (tab === "trial-balance" && !trialBalance && !tbLoading) loadTrialBalance();
    else if (tab === "ledger" && parties.length === 0 && !ledgerLoading) loadLedger();
    else if (tab === "journals" && journals.length === 0 && !journalLoading) loadJournals();
  }, [tab, trialBalance, tbLoading, parties.length, ledgerLoading, journals.length, journalLoading, loadTrialBalance, loadLedger, loadJournals]);

  if (roleError) {
    return (
      <div style={{ padding: "60px 24px", textAlign: "center", fontFamily: SG }}>
        <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--sb-text)", marginBottom: 8 }}>
          Accountant access required
        </p>
        <p style={{ fontSize: TYPE.body, color: "var(--sb-sub)", marginBottom: 24 }}>
          This portal is only accessible to users with the ACCOUNTANT role.
        </p>
        <HKButton onClick={() => router.push("/dashboard")}>Go to Dashboard</HKButton>
      </div>
    );
  }

  const TABS = [
    { id: "trial-balance" as const, label: "Trial Balance" },
    { id: "ledger" as const, label: "Party Ledger" },
    { id: "journals" as const, label: "Journal Entries" },
  ];

  return (
    <div style={{ background: "var(--sb-bg)", minHeight: "100%", fontFamily: SG }}>
      <div style={{ padding: isMobile ? "18px 14px 80px" : "28px 32px 60px", maxWidth: 1100, margin: "0 auto" }}>

        <PageHeader
          title="CA Portal"
          subtitle={`Read-only books view · FY ${from.slice(0, 7)} → ${to}`}
          isMobile={isMobile}
        />

        {/* Read-only notice */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 16px", borderRadius: 12,
          background: C.primary + "10", border: `1px solid ${C.primary}25`,
          marginBottom: 20, fontSize: TYPE.bodySmall, color: C.primary, fontWeight: 600,
        }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Read-only view — no edits possible from this portal
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--sb-border)", paddingBottom: 0 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "10px 18px",
                fontSize: TYPE.body, fontWeight: 600, fontFamily: SG,
                background: "none", border: "none", cursor: "pointer",
                color: tab === t.id ? C.primary : "var(--sb-sub)",
                borderBottom: `2px solid ${tab === t.id ? C.primary : "transparent"}`,
                marginBottom: -1,
                transition: "color 0.15s",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Trial Balance ── */}
        {tab === "trial-balance" && (
          <HKCard style={{ padding: 0 }}>
            {tbLoading ? (
              <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                {[1, 2, 3, 4, 5].map((i) => <HKSkeleton key={i} style={{ height: 36, borderRadius: 8 }} />)}
              </div>
            ) : tbError ? (
              <div style={{ padding: 24, color: OR, fontSize: TYPE.body }}>{tbError}</div>
            ) : !trialBalance ? null : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: TYPE.bodySmall, fontFamily: SG }}>
                  <thead>
                    <tr style={{ background: "var(--sb-badge)", borderBottom: "1px solid var(--sb-border)" }}>
                      <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "var(--sb-sub)" }}>Account</th>
                      <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "var(--sb-sub)" }}>Group</th>
                      <th style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600, color: "var(--sb-sub)", fontFamily: IN }}>Debit</th>
                      <th style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600, color: "var(--sb-sub)", fontFamily: IN }}>Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trialBalance.rows.map((r) => (
                      <tr key={r.accountCode} style={{ borderBottom: "1px solid var(--sb-border)" }}>
                        <td style={{ padding: "10px 16px", fontWeight: 600, color: "var(--sb-text)" }}>{r.accountName}</td>
                        <td style={{ padding: "10px 16px", color: "var(--sb-sub)" }}>{r.tallyGroup}</td>
                        <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: IN, color: r.closingDebit > 0 ? GR : "var(--sb-sub)" }}>
                          {r.closingDebit > 0 ? inr(r.closingDebit) : "—"}
                        </td>
                        <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: IN, color: r.closingCredit > 0 ? OR : "var(--sb-sub)" }}>
                          {r.closingCredit > 0 ? inr(r.closingCredit) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "var(--sb-badge)", fontWeight: 800, fontSize: TYPE.body }}>
                      <td style={{ padding: "12px 16px" }} colSpan={2}>Total</td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: IN, color: GR }}>{inr(trialBalance.totalDebit)}</td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: IN, color: OR }}>{inr(trialBalance.totalCredit)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </HKCard>
        )}

        {/* ── Party Ledger ── */}
        {tab === "ledger" && (
          <HKCard style={{ padding: 0 }}>
            {ledgerLoading ? (
              <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                {[1, 2, 3, 4, 5].map((i) => <HKSkeleton key={i} style={{ height: 36, borderRadius: 8 }} />)}
              </div>
            ) : ledgerError ? (
              <div style={{ padding: 24, color: OR }}>{ledgerError}</div>
            ) : parties.length === 0 ? (
              <div style={{ padding: 24, color: "var(--sb-sub)", textAlign: "center" }}>No parties on record.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: TYPE.bodySmall, fontFamily: SG }}>
                  <thead>
                    <tr style={{ background: "var(--sb-badge)", borderBottom: "1px solid var(--sb-border)" }}>
                      <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "var(--sb-sub)" }}>Party</th>
                      <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "var(--sb-sub)" }}>Type</th>
                      <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "var(--sb-sub)" }}>GSTIN</th>
                      <th style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600, color: "var(--sb-sub)", fontFamily: IN }}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parties.map((p) => (
                      <tr key={p.id} style={{ borderBottom: "1px solid var(--sb-border)" }}>
                        <td style={{ padding: "10px 16px" }}>
                          <p style={{ fontWeight: 600, color: "var(--sb-text)", margin: 0 }}>{p.name}</p>
                          {p.phone && <p style={{ fontSize: TYPE.caption, color: "var(--sb-sub)", margin: 0 }}>{p.phone}</p>}
                        </td>
                        <td style={{ padding: "10px 16px", color: "var(--sb-sub)" }}>{p.type}</td>
                        <td style={{ padding: "10px 16px", fontFamily: IN, fontSize: TYPE.caption, color: "var(--sb-sub)" }}>
                          {p.gstin || "—"}
                        </td>
                        <td style={{
                          padding: "10px 16px", textAlign: "right", fontFamily: IN, fontWeight: 700,
                          color: p.currentBalance < 0 ? GR : p.currentBalance > 0 ? OR : "var(--sb-sub)",
                        }}>
                          {p.currentBalance === 0 ? "Nil" : fmtFull(Math.abs(p.currentBalance))}
                          {p.currentBalance !== 0 && (
                            <span style={{ fontSize: TYPE.caption, fontWeight: 400, marginLeft: 4, color: "var(--sb-sub)" }}>
                              {p.currentBalance < 0 ? "Dr" : "Cr"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </HKCard>
        )}

        {/* ── Journal Entries ── */}
        {tab === "journals" && (
          <div>
            {journalLoading ? (
              <HKCard style={{ padding: 20 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[1, 2, 3, 4, 5].map((i) => <HKSkeleton key={i} style={{ height: 36, borderRadius: 8 }} />)}
                </div>
              </HKCard>
            ) : journalError ? (
              <HKCard>
                <p style={{ color: OR, fontSize: TYPE.body }}>{journalError}</p>
                <p style={{ fontSize: TYPE.bodySmall, color: "var(--sb-sub)", marginTop: 8 }}>
                  Journal export requires PRO plan. Switch to the Trial Balance or Party Ledger tabs.
                </p>
              </HKCard>
            ) : journals.length === 0 ? (
              <HKCard>
                <p style={{ color: "var(--sb-sub)", textAlign: "center", padding: "24px 0" }}>
                  No journal entries in the current financial year, or the export endpoint is unavailable.
                </p>
              </HKCard>
            ) : (
              <HKCard style={{ padding: 0 }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: TYPE.bodySmall, fontFamily: SG }}>
                    <thead>
                      <tr style={{ background: "var(--sb-badge)", borderBottom: "1px solid var(--sb-border)" }}>
                        <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "var(--sb-sub)" }}>Date</th>
                        <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "var(--sb-sub)" }}>Type</th>
                        <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "var(--sb-sub)" }}>Narration</th>
                        <th style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600, color: "var(--sb-sub)", fontFamily: IN }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {journals.map((j) => (
                        <tr key={j.id} style={{ borderBottom: "1px solid var(--sb-border)" }}>
                          <td style={{ padding: "10px 16px", fontFamily: IN, color: "var(--sb-sub)", whiteSpace: "nowrap" }}>
                            {new Date(j.entryDate).toLocaleDateString("en-IN")}
                          </td>
                          <td style={{ padding: "10px 16px", color: "var(--sb-text)", fontWeight: 600 }}>{j.voucherType}</td>
                          <td style={{ padding: "10px 16px", color: "var(--sb-sub)", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {j.narration || "—"}
                          </td>
                          <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: IN, fontWeight: 700, color: "var(--sb-text)" }}>
                            {inr(parseFloat(String(j.totalDebit)))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </HKCard>
            )}

            <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <HKButton
                variant="secondary"
                size="sm"
                onClick={() => {
                  window.open(`/api/export/trial-balance?from=${from}&to=${to}`, "_blank", "noopener,noreferrer");
                }}
              >
                Export Trial Balance CSV
              </HKButton>
              <HKButton
                variant="secondary"
                size="sm"
                onClick={() => {
                  window.open(`/api/export/transactions?from=${from}&to=${to}`, "_blank", "noopener,noreferrer");
                }}
              >
                Export Transactions CSV
              </HKButton>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
