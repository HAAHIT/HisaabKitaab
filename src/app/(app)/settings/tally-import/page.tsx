"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GR, AM, OR, PU, SG, IN, TYPE,
  HKCard, HKToast, PageHeader, useIsMobile,
} from "@/components/ui/hk-design";
import { HKButton } from "@/components/ui/HKButton";

function TallyImportContent() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? "/dashboard";

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importJobId, setImportJobId] = useState<string | null>(null);

  const [preview, setPreview] = useState<{
    vouchersCount: number;
    partiesCount: number;
    salesCount: number;
    purchasesCount: number;
    receiptsCount: number;
    paymentsCount: number;
    journalsCount: number;
    parseErrors: string[];
  } | null>(null);

  const [jobProgress, setJobProgress] = useState({ processed: 0, total: 0, status: "", failed: 0 });
  const [importResult, setImportResult] = useState<{
    imported: number; skipped: number; partiesCreated: number; failed: number; parseErrors: string[]; importErrors: string[];
    failures: Array<{ voucherType: string; narration: string; entryDate: string; reason: string }>;
    roundOffAdjustments: Array<{ voucherType: string; narration: string; entryDate: string; imbalance: number }>;
  } | null>(null);
  const [showFailures, setShowFailures] = useState(false);
  const [showRoundOff, setShowRoundOff] = useState(false);

  useEffect(() => {
    fetch("/api/import/active")
      .then((r) => r.json())
      .then((data) => {
        if (data.active && data.jobId) {
          setImportJobId(data.jobId);
          setJobProgress({ processed: data.processed ?? 0, total: data.totalItems ?? 0, status: data.status, failed: data.failed ?? 0 });
          setStep(3);
          pollStatus(data.jobId);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }

  const handleFetchPreview = async () => {
    if (!importFile) return;
    setLoading(true);
    try {
      const body = new FormData();
      body.append("file", importFile);
      const res = await fetch("/api/import/tally-xml/preview", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Preview fetch failed");
      setPreview(data);
      setStep(2);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load preview", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setStep(3);
    try {
      const body = new FormData();
      body.append("file", importFile);
      const res = await fetch("/api/import/tally-xml", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      if (data.jobId) {
        setImportJobId(data.jobId);
        setJobProgress({ processed: 0, total: preview?.vouchersCount || 0, status: "PENDING", failed: 0 });
        pollStatus(data.jobId);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Import failed", "error");
      setStep(2);
      setImporting(false);
    }
  };

  const pollStatus = (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/import/status/${jobId}`);
        if (!res.ok) throw new Error("Failed to fetch job status");
        const data = await res.json();
        setJobProgress({ processed: data.processed, total: data.totalItems, status: data.status, failed: data.failed });
        if (data.status === "COMPLETED" || data.status === "FAILED") {
          clearInterval(interval);
          setImporting(false);
          setImportJobId(null);
          if (data.status === "COMPLETED") {
            const skipped = data.skipped ?? 0;
            setImportResult({
              partiesCreated: data.partiesCreated ?? 0,
              imported: Math.max(0, (data.processed ?? 0) - skipped),
              skipped,
              failed: data.failed,
              parseErrors: preview?.parseErrors || [],
              importErrors: [],
              failures: Array.isArray(data.failures) ? data.failures : [],
              roundOffAdjustments: Array.isArray(data.roundOffAdjustments) ? data.roundOffAdjustments : [],
            });
            setStep(4);
          } else {
            showToast(data.error || "Job failed in background", "error");
            setStep(2);
          }
        }
      } catch {
        // poll will retry on next tick
      }
    }, 2000);
  };

  const statCardStyle: React.CSSProperties = {
    padding: "14px 16px", borderRadius: 12,
    background: "var(--sb-bg)", border: "1px solid var(--sb-border)",
  };

  const navBtnStyle = (primary?: boolean): React.CSSProperties => ({
    minHeight: 44, padding: "0 20px", borderRadius: 12,
    background: primary ? undefined : "var(--sb-badge)",
    border: primary ? undefined : "1px solid var(--sb-border)",
    color: primary ? undefined : "var(--sb-text)",
    fontFamily: SG, fontSize: TYPE.body, fontWeight: 600, cursor: "pointer",
    display: "flex", alignItems: "center", gap: 6,
  });

  return (
    <>
      {toast && <HKToast message={toast.message} type={toast.type} />}

      <div style={{ fontFamily: SG }}>
        <PageHeader title="Tally se Laao" subtitle="Import historical vouchers and masters from Tally." isMobile={isMobile} />
        <div>
          {/* Step progress */}
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ height: 8, flex: 1, borderRadius: 999, background: step >= i ? PU : "var(--sb-border)", transition: "background 0.3s" }} />
            ))}
          </div>

          <HKCard>
            {step === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--sb-text)", fontFamily: SG, margin: 0 }}>
                  XML file choose karo
                </p>

                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  border: "2px dashed var(--sb-border)", borderRadius: 16, padding: "40px 20px",
                  background: "var(--sb-bg)",
                }}>
                  <span style={{ fontSize: 48, marginBottom: 16 }}>📄</span>
                  <label style={{ cursor: "pointer" }}>
                    <input
                      type="file"
                      accept=".xml,text/xml,application/xml"
                      onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                      style={{ display: "none" }}
                    />
                    <div style={{
                      padding: "10px 20px", borderRadius: 12,
                      background: PU + "18", border: `1px solid ${PU}44`,
                      color: PU, fontFamily: SG, fontSize: TYPE.bodySmall, fontWeight: 700,
                      display: "flex", alignItems: "center", gap: 8,
                    }}>
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      XML File Choose Karo
                    </div>
                  </label>
                  {importFile ? (
                    <p style={{ marginTop: 12, fontSize: TYPE.bodySmall, color: GR, fontFamily: SG, fontWeight: 600 }}>
                      ✓ {importFile.name}
                    </p>
                  ) : (
                    <p style={{ marginTop: 12, fontSize: TYPE.bodySmall, color: "var(--sb-sub)", fontFamily: SG }}>
                      Only Tally XML files up to 5MB.
                    </p>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <HKButton onClick={handleFetchPreview} isLoading={loading} isDisabled={!importFile}>Aage Badho →</HKButton>
                </div>
              </div>
            )}

            {step === 2 && preview && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--sb-text)", fontFamily: SG, margin: 0 }}>
                  Import Preview
                </p>

                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: 12 }}>
                  {[
                    { label: "Party Masters", value: preview.partiesCount },
                    { label: "Sales", value: preview.salesCount },
                    { label: "Purchases", value: preview.purchasesCount },
                    { label: "Receipts", value: preview.receiptsCount },
                    { label: "Payments", value: preview.paymentsCount },
                    { label: "Journals", value: preview.journalsCount },
                  ].map(({ label, value }) => (
                    <div key={label} style={statCardStyle}>
                      <p style={{ fontSize: TYPE.caption, fontWeight: 700, color: "var(--sb-sub)", textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: SG, marginBottom: 4 }}>
                        {label}
                      </p>
                      <p style={{ fontSize: TYPE.numMedium, fontWeight: 700, color: "var(--sb-text)", fontFamily: IN, margin: 0 }}>
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                {preview.parseErrors?.length > 0 && (
                  <div style={{ padding: 14, borderRadius: 12, background: AM + "10", border: `1px solid ${AM}33` }}>
                    <p style={{ fontSize: TYPE.bodySmall, fontWeight: 700, color: AM, fontFamily: SG, marginBottom: 8 }}>
                      ⚠ Warnings
                    </p>
                    <ul style={{ paddingLeft: 16, margin: 0 }}>
                      {preview.parseErrors.slice(0, 5).map((e, i) => (
                        <li key={i} style={{ fontSize: TYPE.caption, color: AM, fontFamily: SG, marginBottom: 2 }}>{e}</li>
                      ))}
                      {preview.parseErrors.length > 5 && (
                        <li style={{ fontSize: TYPE.caption, color: AM, fontFamily: SG }}>
                          ... and {preview.parseErrors.length - 5} more
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <button onClick={() => setStep(1)} style={navBtnStyle()}>← Wapas</button>
                  <HKButton onClick={handleImport}>Haan, Import Karo →</HKButton>
                </div>
              </div>
            )}

            {step === 3 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "32px 0", textAlign: "center" }}>
                <div style={{
                  width: 64, height: 64,
                  border: `4px solid var(--sb-border)`,
                  borderTopColor: PU,
                  borderRadius: "50%",
                }} className="animate-spin" />
                <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--sb-text)", fontFamily: SG, margin: 0 }}>
                  Import chal raha hai...
                </p>
                <p style={{ fontSize: TYPE.bodySmall, color: "var(--sb-sub)", fontFamily: SG, margin: 0 }}>
                  Yeh process server pe background mein chal raha hai.<br />
                  Page band karo ya kahi bhi jao — import rukega nahi.
                </p>

                {importJobId && (
                  <div style={{ width: "100%", maxWidth: 320, marginTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: TYPE.caption, color: "var(--sb-sub)", fontFamily: SG }}>{jobProgress.processed} processed</span>
                      <span style={{ fontSize: TYPE.caption, color: "var(--sb-sub)", fontFamily: SG }}>{jobProgress.total} total</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: "var(--sb-border)", overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 999, background: PU,
                        width: `${Math.max(5, (jobProgress.processed / (jobProgress.total || 1)) * 100)}%`,
                        transition: "width 0.4s ease",
                      }} />
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 8 }}>
                  <button onClick={() => router.push(returnTo)} style={navBtnStyle()}>
                    {returnTo === "/dashboard" ? "Dashboard Par Jao" : "Wapas Jao"}
                  </button>
                </div>
              </div>
            )}

            {step === 4 && importResult && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "24px 0", textAlign: "center" }}>
                <span style={{ fontSize: 52 }}>🎉</span>
                <p style={{ fontSize: TYPE.h1, fontWeight: 800, color: "var(--sb-text)", fontFamily: SG, margin: 0 }}>
                  Ho gaya!
                </p>
                <p style={{ fontSize: TYPE.body, color: "var(--sb-sub)", fontFamily: SG, margin: 0 }}>
                  Tally data has been imported successfully.
                </p>

                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12, marginTop: 16, width: "100%", maxWidth: 320, textAlign: "center" }}>
                  {importResult.imported > 0 && (
                    <div style={{ padding: "14px 16px", borderRadius: 12, background: GR + "10", border: `1px solid ${GR}33`, minWidth: 130 }}>
                      <p style={{ fontSize: TYPE.caption, fontWeight: 700, color: GR, textTransform: "uppercase", fontFamily: SG, marginBottom: 4 }}>Imported</p>
                      <p style={{ fontSize: TYPE.numMedium, fontWeight: 700, color: GR, fontFamily: IN, margin: 0 }}>{importResult.imported}</p>
                    </div>
                  )}
                  {importResult.partiesCreated > 0 && (
                    <div style={{ padding: "14px 16px", borderRadius: 12, background: PU + "10", border: `1px solid ${PU}33`, minWidth: 130 }}>
                      <p style={{ fontSize: TYPE.caption, fontWeight: 700, color: PU, textTransform: "uppercase", fontFamily: SG, marginBottom: 4 }}>Parties</p>
                      <p style={{ fontSize: TYPE.numMedium, fontWeight: 700, color: PU, fontFamily: IN, margin: 0 }}>{importResult.partiesCreated}</p>
                    </div>
                  )}
                  {importResult.skipped > 0 && (
                    <div style={{ padding: "14px 16px", borderRadius: 12, background: "var(--sb-badge)", border: "1px solid var(--sb-border)", minWidth: 130 }}>
                      <p style={{ fontSize: TYPE.caption, fontWeight: 700, color: "var(--sb-sub)", textTransform: "uppercase", fontFamily: SG, marginBottom: 4 }}>Skipped</p>
                      <p style={{ fontSize: TYPE.numMedium, fontWeight: 700, color: "var(--sb-sub)", fontFamily: IN, margin: 0 }}>{importResult.skipped}</p>
                    </div>
                  )}
                  {importResult.failed > 0 && (
                    <div style={{ padding: "14px 16px", borderRadius: 12, background: OR + "10", border: `1px solid ${OR}33`, minWidth: 130 }}>
                      <p style={{ fontSize: TYPE.caption, fontWeight: 700, color: OR, textTransform: "uppercase", fontFamily: SG, marginBottom: 4 }}>Failed</p>
                      <p style={{ fontSize: TYPE.numMedium, fontWeight: 700, color: OR, fontFamily: IN, margin: 0 }}>{importResult.failed}</p>
                    </div>
                  )}
                  {importResult.roundOffAdjustments.length > 0 && (() => {
                    const totalAbs = importResult.roundOffAdjustments.reduce(
                      (s, a) => s + Math.abs(a.imbalance), 0
                    );
                    return (
                      <div style={{ padding: "14px 16px", borderRadius: 12, background: AM + "10", border: `1px solid ${AM}33`, minWidth: 130 }}>
                        <p style={{ fontSize: TYPE.caption, fontWeight: 700, color: AM, textTransform: "uppercase", fontFamily: SG, marginBottom: 4 }}>Round Off</p>
                        <p style={{ fontSize: TYPE.numMedium, fontWeight: 700, color: AM, fontFamily: IN, margin: 0 }}>₹{totalAbs.toFixed(2)}</p>
                        <p style={{ fontSize: TYPE.caption, color: AM, fontFamily: SG, margin: "2px 0 0" }}>{importResult.roundOffAdjustments.length} voucher{importResult.roundOffAdjustments.length === 1 ? "" : "s"}</p>
                      </div>
                    );
                  })()}
                </div>

                {importResult.roundOffAdjustments.length > 0 && (
                  <div style={{ marginTop: 16, width: "100%", maxWidth: 560 }}>
                    <button
                      type="button"
                      onClick={() => setShowRoundOff((v) => !v)}
                      style={{
                        background: "none", border: "none", padding: 0,
                        color: AM, fontFamily: SG, fontSize: TYPE.caption,
                        fontWeight: 600, cursor: "pointer", textDecoration: "underline",
                      }}
                    >
                      {showRoundOff ? "Hide" : "Show"} round-off detail
                    </button>
                    {showRoundOff && (
                      <div style={{ marginTop: 8, maxHeight: 240, overflowY: "auto", textAlign: "left", border: "1px solid var(--sb-border)", borderRadius: 8 }}>
                        {importResult.roundOffAdjustments.map((a, idx) => (
                          <div key={idx} style={{ padding: "10px 12px", borderBottom: idx === importResult.roundOffAdjustments.length - 1 ? "none" : "1px solid var(--sb-border)", fontSize: TYPE.caption, fontFamily: SG, display: "flex", justifyContent: "space-between", gap: 12 }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ color: AM, fontWeight: 600 }}>{a.voucherType} · {new Date(a.entryDate).toLocaleDateString("en-IN")}</div>
                              {a.narration && <div style={{ color: "var(--sb-sub)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.narration}</div>}
                            </div>
                            <div style={{ color: "var(--sb-text)", fontFamily: IN, fontWeight: 600, whiteSpace: "nowrap" }}>
                              {a.imbalance > 0 ? "+" : ""}₹{a.imbalance.toFixed(2)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {importResult.failures.length > 0 && (
                  <div style={{ marginTop: 16, width: "100%", maxWidth: 560 }}>
                    <button
                      type="button"
                      onClick={() => setShowFailures((v) => !v)}
                      style={{
                        background: "none", border: "none", padding: 0,
                        color: OR, fontFamily: SG, fontSize: TYPE.caption,
                        fontWeight: 600, cursor: "pointer", textDecoration: "underline",
                      }}
                    >
                      {showFailures ? "Hide" : "Show"} {importResult.failures.length} failure{importResult.failures.length === 1 ? "" : "s"}
                    </button>
                    {showFailures && (
                      <div style={{ marginTop: 8, maxHeight: 240, overflowY: "auto", textAlign: "left", border: "1px solid var(--sb-border)", borderRadius: 8 }}>
                        {importResult.failures.map((f, idx) => (
                          <div key={idx} style={{ padding: "10px 12px", borderBottom: idx === importResult.failures.length - 1 ? "none" : "1px solid var(--sb-border)", fontSize: TYPE.caption, fontFamily: SG }}>
                            <div style={{ color: OR, fontWeight: 600 }}>{f.voucherType} · {new Date(f.entryDate).toLocaleDateString("en-IN")}</div>
                            {f.narration && <div style={{ color: "var(--sb-sub)", marginTop: 2 }}>{f.narration}</div>}
                            <div style={{ color: "var(--sb-text)", marginTop: 4 }}>{f.reason}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ marginTop: 24 }}>
                  <HKButton onClick={() => router.push(returnTo)}>
                    {returnTo === "/dashboard" ? "Dashboard Par Jao" : "Wapas Jao"}
                  </HKButton>
                </div>
              </div>
            )}
          </HKCard>
        </div>
      </div>
    </>
  );
}

export default function TallyImportPage() {
  return (
    <Suspense fallback={null}>
      <TallyImportContent />
    </Suspense>
  );
}
