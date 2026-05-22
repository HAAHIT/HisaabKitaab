"use client";

import { useEffect, useMemo, useState, startTransition } from "react";
import { HKSelect, HKSelectItem } from "@/components/ui/HKSelect";
import { HKSkeleton } from "@/components/ui/HKSkeleton";
import { HKInput } from "@/components/ui/HKInput";
import { HKButton } from "@/components/ui/HKButton";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getCurrentFinancialYearRange,
  getCurrentQuarterRange,
} from "@/lib/journal-reporting";

interface ReportsClientProps {
  initialFrom: string;
  initialTo: string;
  totalEntries: number;
  unbalancedCount: number;
  parties: { id: string; name: string; type: string }[];
}

interface GstMonthRow {
  month: string;
  b2bCount: number;
  b2cCount: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  grandTotal: number;
}

interface GstHsnRow {
  hsnCode: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  grandTotal: number;
  invoiceCount: number;
}

interface GstB2bRow {
  partyName: string;
  gstin: string;
  invoiceCount: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  grandTotal: number;
}

interface GstReport {
  totalBills: number;
  totals: {
    taxableValue: number;
    cgst: number;
    sgst: number;
    igst: number;
    grandTotal: number;
  };
  monthWise: GstMonthRow[];
  hsnSummary: GstHsnRow[];
  b2bParties: GstB2bRow[];
}

interface TrialBalancePreview {
  rows: {
    accountCode: string;
    accountName: string;
    totalDebit: number;
    totalCredit: number;
    closingDebit: number;
    closingCredit: number;
  }[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

type DatePreset = "currentFy" | "currentQuarter" | "custom";

function buildDownloadUrl(path: string, params: Record<string, string>) {
  const query = new URLSearchParams(params);
  return `${path}?${query.toString()}`;
}

function downloadFile(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function inr(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(n);
}

type TallyImportResult = {
  partiesCreated: number;
  imported: number;
  skipped: number;
  failed: number;
  parseErrors: string[];
  importErrors: string[];
};

export default function ReportsClient({
  initialFrom,
  initialTo,
  totalEntries,
  unbalancedCount,
  parties,
}: ReportsClientProps) {
  const { t } = useLanguage();
  const [preset, setPreset] = useState<DatePreset>("currentFy");
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [tallyExportType, setTallyExportType] = useState<"all" | "masters" | "vouchers">("all");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<TallyImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importJobId, setImportJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState({ processed: 0, total: 0, status: "" });
  const [preview, setPreview] = useState<TrialBalancePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [gstReport, setGstReport] = useState<GstReport | null>(null);
  const [gstLoading, setGstLoading] = useState(false);
  const [gstError, setGstError] = useState<string | null>(null);
  const [gstTab, setGstTab] = useState<"month" | "hsn" | "b2b">("month");

  const exportBlocked = unbalancedCount > 0;

  const presetOptions = useMemo(() => {
    const fy = getCurrentFinancialYearRange();
    const quarter = getCurrentQuarterRange();

    return [
      {
        key: "currentFy",
        label: `${t("reports.financialYear")} (${fy.label})`,
        from: fy.from,
        to: fy.to,
      },
      {
        key: "currentQuarter",
        label: `${t("reports.currentQuarter")} (${quarter.label})`,
        from: quarter.from,
        to: quarter.to,
      },
      {
        key: "custom",
        label: t("reports.customRange"),
        from,
        to,
      },
    ];
  }, [from, t, to]);

  function applyPreset(nextPreset: DatePreset) {
    setPreset(nextPreset);
    setPreview(null);
    setPreviewError(null);

    if (nextPreset === "currentFy") {
      const nextRange = getCurrentFinancialYearRange();
      setFrom(nextRange.from);
      setTo(nextRange.to);
      return;
    }

    if (nextPreset === "currentQuarter") {
      const nextRange = getCurrentQuarterRange();
      setFrom(nextRange.from);
      setTo(nextRange.to);
    }
  }

  useEffect(() => {
    if (exportBlocked) {
      return;
    }

    const controller = new AbortController();

    void fetch(
      buildDownloadUrl("/api/export/trial-balance", {
        from,
        to,
        format: "json",
      }),
      { signal: controller.signal }
    )
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || "Failed to load trial balance");
        }

        return response.json() as Promise<TrialBalancePreview>;
      })
      .then((payload) => {
        startTransition(() => {
          setPreview(payload);
        });
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        setPreviewError(
          error instanceof Error ? error.message : t("reports.previewFailed")
        );
      });

    return () => controller.abort();
  }, [exportBlocked, from, t, to]);

  useEffect(() => {
    if (!from || !to) return;
    const controller = new AbortController();
    setGstLoading(true);
    setGstError(null);

    void fetch(
      buildDownloadUrl("/api/reports/gst", { from, to }),
      { signal: controller.signal }
    )
      .then(async (res) => {
        if (!res.ok) {
          const p = await res.json().catch(() => null);
          throw new Error(p?.error || "Failed to load GST report");
        }
        return res.json() as Promise<GstReport>;
      })
      .then((data) => {
        startTransition(() => {
          setGstReport(data);
          setGstLoading(false);
        });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setGstError(err instanceof Error ? err.message : "Error loading GST data");
        setGstLoading(false);
      });

    return () => controller.abort();
  }, [from, to]);

  useEffect(() => {
    if (!importJobId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/import/status/${importJobId}`);
        if (!res.ok) throw new Error("Failed to fetch job status");
        const data = await res.json();

        setJobProgress({
          processed: data.processed, // Total successfully or skipped processed
          total: data.totalItems,
          status: data.status,
        });

        if (data.status === "COMPLETED" || data.status === "FAILED") {
          clearInterval(interval);
          setImporting(false);
          setImportJobId(null);

          if (data.status === "COMPLETED") {
            setImportResult({
              partiesCreated: 0, // Detailed metrics omitted in async architecture
              imported: data.processed, 
              skipped: 0,
              failed: data.failed,
              parseErrors: [],
              importErrors: [],
            });
          } else {
            setImportError(data.error || "Job failed in background");
          }
        }
      } catch {
        // polling failure is transient; next interval will retry
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [importJobId]);

  async function handleImport() {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    setImportError(null);
    try {
      const body = new FormData();
      body.append("file", importFile);
      const res = await fetch("/api/import/tally-xml", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      
      if (data.jobId) {
        setImportJobId(data.jobId);
        setJobProgress({ processed: 0, total: data.totalDetected || 0, status: "PENDING" });
      } else {
        setImportResult(data as TallyImportResult);
        setImporting(false);
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
      setImporting(false);
    }
  }

  const transactionUrl = buildDownloadUrl("/api/export/transactions", {
    from,
    to,
    format: "csv",
  });
  const trialBalanceUrl = buildDownloadUrl("/api/export/trial-balance", {
    from,
    to,
    format: "csv",
  });
  const partyLedgerUrl = selectedPartyId
    ? buildDownloadUrl("/api/export/party-ledger", {
        from,
        to,
        partyId: selectedPartyId,
        format: "csv",
      })
    : "";

  return (
    <div className="animate-fade-in p-4 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("reports.title")}</h1>
        <p className="mt-1 text-sm text-default-500">{t("reports.subtitle")}</p>
      </div>

      <div className="rounded-2xl border border-[var(--sb-border)] bg-[var(--sb-card)] shadow-sm">
        <div className="space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold">{t("reports.dateRange")}</h2>
            <p className="text-sm text-default-500">{t("reports.financialYearHelp")}</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[260px,1fr,1fr]">
            <HKSelect
              label={t("reports.financialYear")}
              value={preset}
              onValueChange={(v) => {
                if (v === "currentFy" || v === "currentQuarter" || v === "custom") {
                  applyPreset(v);
                }
              }}
            >
              {presetOptions.map((option) => (
                <HKSelectItem key={option.key} value={option.key}>{option.label}</HKSelectItem>
              ))}
            </HKSelect>

            <HKInput
              label={t("reports.from")}
              type="date"
              value={from}
              onValueChange={(value) => {
                setPreset("custom");
                setPreview(null);
                setPreviewError(null);
                setFrom(value);
              }}
            />

            <HKInput
              label={t("reports.to")}
              type="date"
              value={to}
              onValueChange={(value) => {
                setPreset("custom");
                setPreview(null);
                setPreviewError(null);
                setTo(value);
              }}
            />
          </div>
        </div>
      </div>

      {/* ── GST Summary Report ──────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-[var(--sb-border)] bg-[var(--sb-card)] shadow-sm">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-semibold">GST Sales Summary</h2>
              <p className="text-sm text-default-500 mt-0.5">
                FINAL bills only · GSTR-1 reference data
              </p>
            </div>
            {gstReport && (
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="text-default-500">
                  <span className="font-bold text-foreground">{gstReport.totalBills}</span> invoices
                </span>
                <span className="text-default-500">
                  Taxable: <span className="font-bold text-foreground">{inr(gstReport.totals.taxableValue)}</span>
                </span>
                <span className="text-default-500">
                  CGST: <span className="font-semibold">{inr(gstReport.totals.cgst)}</span>
                </span>
                <span className="text-default-500">
                  SGST: <span className="font-semibold">{inr(gstReport.totals.sgst)}</span>
                </span>
                {gstReport.totals.igst > 0 && (
                  <span className="text-default-500">
                    IGST: <span className="font-semibold">{inr(gstReport.totals.igst)}</span>
                  </span>
                )}
                <span className="text-default-500">
                  Grand Total: <span className="font-bold text-foreground">{inr(gstReport.totals.grandTotal)}</span>
                </span>
              </div>
            )}
          </div>

          {/* Tab switcher */}
          <div className="flex gap-2 border-b border-divider pb-1">
            {(["month", "hsn", "b2b"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setGstTab(tab)}
                className={`px-3 py-1.5 text-sm font-semibold rounded-t transition-colors ${
                  gstTab === tab
                    ? "border-b-2 border-primary text-primary bg-primary/5"
                    : "text-default-500 hover:text-foreground"
                }`}
              >
                {tab === "month" ? "Month-wise" : tab === "hsn" ? "HSN Summary" : "B2B Parties"}
              </button>
            ))}
          </div>

          {gstLoading ? (
            <div className="grid gap-2">
              {[1, 2, 3].map((i) => <HKSkeleton key={i} className="h-10 rounded-xl" />)}
            </div>
          ) : gstError ? (
            <p className="text-sm text-danger">{gstError}</p>
          ) : !gstReport || gstReport.totalBills === 0 ? (
            <p className="text-sm text-default-500 py-4 text-center">
              No final bills found in this period
            </p>
          ) : (
            <div className="overflow-x-auto">
              {gstTab === "month" && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-divider text-xs text-default-500 uppercase tracking-wide">
                      <th className="py-2 pr-4 text-left font-semibold">Month</th>
                      <th className="py-2 pr-4 text-right font-semibold">B2B</th>
                      <th className="py-2 pr-4 text-right font-semibold">B2C</th>
                      <th className="py-2 pr-4 text-right font-semibold">Taxable Value</th>
                      <th className="py-2 pr-4 text-right font-semibold">CGST</th>
                      <th className="py-2 pr-4 text-right font-semibold">SGST</th>
                      <th className="py-2 pr-4 text-right font-semibold">IGST</th>
                      <th className="py-2 text-right font-semibold">Grand Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gstReport.monthWise.map((row) => (
                      <tr key={row.month} className="border-b border-divider/40 hover:bg-default-50">
                        <td className="py-2.5 pr-4 font-medium">{row.month}</td>
                        <td className="py-2.5 pr-4 text-right text-default-500">{row.b2bCount}</td>
                        <td className="py-2.5 pr-4 text-right text-default-500">{row.b2cCount}</td>
                        <td className="py-2.5 pr-4 text-right">{inr(row.taxableValue)}</td>
                        <td className="py-2.5 pr-4 text-right text-default-600">{inr(row.cgst)}</td>
                        <td className="py-2.5 pr-4 text-right text-default-600">{inr(row.sgst)}</td>
                        <td className="py-2.5 pr-4 text-right text-default-600">{row.igst > 0 ? inr(row.igst) : "—"}</td>
                        <td className="py-2.5 text-right font-bold">{inr(row.grandTotal)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-divider bg-default-50 font-bold">
                      <td className="py-2.5 pr-4">Total</td>
                      <td className="py-2.5 pr-4 text-right">{gstReport.monthWise.reduce((s, r) => s + r.b2bCount, 0)}</td>
                      <td className="py-2.5 pr-4 text-right">{gstReport.monthWise.reduce((s, r) => s + r.b2cCount, 0)}</td>
                      <td className="py-2.5 pr-4 text-right">{inr(gstReport.totals.taxableValue)}</td>
                      <td className="py-2.5 pr-4 text-right">{inr(gstReport.totals.cgst)}</td>
                      <td className="py-2.5 pr-4 text-right">{inr(gstReport.totals.sgst)}</td>
                      <td className="py-2.5 pr-4 text-right">{gstReport.totals.igst > 0 ? inr(gstReport.totals.igst) : "—"}</td>
                      <td className="py-2.5 text-right">{inr(gstReport.totals.grandTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              )}

              {gstTab === "hsn" && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-divider text-xs text-default-500 uppercase tracking-wide">
                      <th className="py-2 pr-4 text-left font-semibold">HSN/SAC Code</th>
                      <th className="py-2 pr-4 text-right font-semibold">Invoices</th>
                      <th className="py-2 pr-4 text-right font-semibold">Taxable Value</th>
                      <th className="py-2 pr-4 text-right font-semibold">CGST</th>
                      <th className="py-2 pr-4 text-right font-semibold">SGST</th>
                      <th className="py-2 pr-4 text-right font-semibold">IGST</th>
                      <th className="py-2 text-right font-semibold">Grand Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gstReport.hsnSummary.map((row) => (
                      <tr key={row.hsnCode} className="border-b border-divider/40 hover:bg-default-50">
                        <td className="py-2.5 pr-4 font-mono font-semibold">{row.hsnCode}</td>
                        <td className="py-2.5 pr-4 text-right text-default-500">{row.invoiceCount}</td>
                        <td className="py-2.5 pr-4 text-right">{inr(row.taxableValue)}</td>
                        <td className="py-2.5 pr-4 text-right text-default-600">{inr(row.cgst)}</td>
                        <td className="py-2.5 pr-4 text-right text-default-600">{inr(row.sgst)}</td>
                        <td className="py-2.5 pr-4 text-right text-default-600">{row.igst > 0 ? inr(row.igst) : "—"}</td>
                        <td className="py-2.5 text-right font-bold">{inr(row.grandTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {gstTab === "b2b" && (
                gstReport.b2bParties.length === 0 ? (
                  <p className="text-sm text-default-500 py-4 text-center">
                    No B2B parties (GSTIN-registered buyers) found in this period
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-divider text-xs text-default-500 uppercase tracking-wide">
                        <th className="py-2 pr-4 text-left font-semibold">Party</th>
                        <th className="py-2 pr-4 text-left font-semibold">GSTIN</th>
                        <th className="py-2 pr-4 text-right font-semibold">Invoices</th>
                        <th className="py-2 pr-4 text-right font-semibold">Taxable Value</th>
                        <th className="py-2 pr-4 text-right font-semibold">CGST</th>
                        <th className="py-2 pr-4 text-right font-semibold">SGST</th>
                        <th className="py-2 pr-4 text-right font-semibold">IGST</th>
                        <th className="py-2 text-right font-semibold">Grand Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gstReport.b2bParties.map((row) => (
                        <tr key={row.gstin} className="border-b border-divider/40 hover:bg-default-50">
                          <td className="py-2.5 pr-4 font-medium">{row.partyName}</td>
                          <td className="py-2.5 pr-4 font-mono text-xs text-default-500">{row.gstin}</td>
                          <td className="py-2.5 pr-4 text-right text-default-500">{row.invoiceCount}</td>
                          <td className="py-2.5 pr-4 text-right">{inr(row.taxableValue)}</td>
                          <td className="py-2.5 pr-4 text-right text-default-600">{inr(row.cgst)}</td>
                          <td className="py-2.5 pr-4 text-right text-default-600">{inr(row.sgst)}</td>
                          <td className="py-2.5 pr-4 text-right text-default-600">{row.igst > 0 ? inr(row.igst) : "—"}</td>
                          <td className="py-2.5 text-right font-bold">{inr(row.grandTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-[var(--sb-border)] bg-[var(--sb-card)] shadow-sm">
          <div className="space-y-3 p-6">
            <div>
              <h3 className="text-lg font-semibold">{t("reports.transactionRegister")}</h3>
              <p className="text-sm text-default-500">{t("reports.transactionDesc")}</p>
            </div>
            <HKButton
              isDisabled={exportBlocked}
              onClick={() => downloadFile(transactionUrl)}
            >
              {t("reports.downloadCSV")}
            </HKButton>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--sb-border)] bg-[var(--sb-card)] shadow-sm">
          <div className="space-y-3 p-6">
            <div>
              <h3 className="text-lg font-semibold">{t("reports.trialBalance")}</h3>
              <p className="text-sm text-default-500">{t("reports.trialBalanceDesc")}</p>
            </div>
            <HKButton
              isDisabled={exportBlocked}
              onClick={() => downloadFile(trialBalanceUrl)}
            >
              {t("reports.downloadCSV")}
            </HKButton>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--sb-border)] bg-[var(--sb-card)] shadow-sm">
          <div className="space-y-3 p-6">
            <div>
              <h3 className="text-lg font-semibold">{t("reports.partyLedger")}</h3>
              <p className="text-sm text-default-500">{t("reports.partyLedgerDesc")}</p>
            </div>
            <HKSelect
              label={t("reports.selectParty")}
              value={selectedPartyId}
              onValueChange={(v) => { if (v) setSelectedPartyId(v); }}
            >
              {parties.map((party) => (
                <HKSelectItem key={party.id} value={party.id}>
                  {party.name} ({party.type.toLowerCase()})
                </HKSelectItem>
              ))}
            </HKSelect>
            <HKButton
              isDisabled={exportBlocked || !selectedPartyId}
              onClick={() => downloadFile(partyLedgerUrl)}
            >
              {t("reports.downloadCSV")}
            </HKButton>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-amber-500/20 bg-[var(--sb-card)] shadow-sm">
          <div className="p-6 flex flex-col justify-between items-start gap-4">
            <div className="flex items-start gap-3 w-full">
              <div className="flex-1">
                <h3 className="text-lg font-semibold">{t("reports.tallyExport")}</h3>
                <p className="text-sm text-default-500 mt-1">{t("reports.tallyExportDesc")}</p>
              </div>
              <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                Tally
              </span>
            </div>
            <HKButton
              className="w-full sm:w-auto"
              onClick={() => window.location.href = "/settings/tally-export"}
            >
              Send to CA →
            </HKButton>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-[var(--sb-card)] shadow-sm">
          <div className="p-6 flex flex-col justify-between items-start gap-4">
            <div className="flex items-start gap-3 w-full">
              <div className="flex-1">
                <h3 className="text-lg font-semibold">{t("reports.tallyImport")}</h3>
                <p className="text-sm text-default-500 mt-1">{t("reports.tallyImportDesc")}</p>
              </div>
              <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                Tally
              </span>
            </div>
            <HKButton
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => window.location.href = "/settings/tally-import"}
            >
              Start Import →
            </HKButton>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--sb-border)] bg-[var(--sb-card)] shadow-sm">
        <div className="space-y-4 p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">{t("reports.systemCheck")}</h2>
            <p className="text-sm text-default-500">
              {totalEntries} {t("reports.totalEntries")}
            </p>
          </div>

          {exportBlocked ? (
            <div className="rounded-2xl border border-danger/20 bg-danger/5 p-4 text-danger">
              <p className="font-semibold">
                {unbalancedCount} {t("reports.unbalanced")}
              </p>
              <p className="mt-1 text-sm text-danger/80">
                {t("reports.exportBlocked")}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-success/20 bg-success/5 p-4 text-success">
              <p className="font-semibold">{t("reports.allBalanced")}</p>
            </div>
          )}

          <div className="rounded-2xl border border-divider bg-default-50/80 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">{t("reports.periodSummary")}</h3>
                <p className="text-sm text-default-500">
                  {t("reports.periodSummaryDesc")}
                </p>
              </div>
            </div>

            {exportBlocked ? (
              <p className="text-sm text-default-500">{t("reports.exportBlocked")}</p>
            ) : !preview && !previewError ? (
              <div className="grid gap-3 md:grid-cols-3">
                {[1, 2, 3].map((index) => (
                  <HKSkeleton key={index} className="h-20 rounded-xl" />
                ))}
              </div>
            ) : previewError ? (
              <p className="text-sm text-danger">{previewError}</p>
            ) : preview ? (
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl bg-background p-4">
                  <p className="text-xs uppercase tracking-wide text-default-400">
                    {t("reports.accounts")}
                  </p>
                  <p className="mt-1 text-2xl font-semibold">{preview.rows.length}</p>
                </div>
                <div className="rounded-xl bg-background p-4">
                  <p className="text-xs uppercase tracking-wide text-default-400">
                    {t("reports.totalDebit")}
                  </p>
                  <p className="mt-1 text-2xl font-semibold">
                    ₹{preview.totalDebit.toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="rounded-xl bg-background p-4">
                  <p className="text-xs uppercase tracking-wide text-default-400">
                    {t("reports.totalCredit")}
                  </p>
                  <p className="mt-1 text-2xl font-semibold">
                    ₹{preview.totalCredit.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-default-500">{t("reports.noPreview")}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
