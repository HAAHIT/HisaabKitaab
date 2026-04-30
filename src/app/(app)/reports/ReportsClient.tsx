"use client";

import { useEffect, useMemo, useState, startTransition } from "react";
import {
  Button,
  Card,
  CardBody,
  Input,
  Select,
  SelectItem,
  Skeleton,
} from "@heroui/react";
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
      } catch (err) {
        console.error(err);
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

      <Card shadow="sm">
        <CardBody className="space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold">{t("reports.dateRange")}</h2>
            <p className="text-sm text-default-500">{t("reports.financialYearHelp")}</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[260px,1fr,1fr]">
            <Select
              label={t("reports.financialYear")}
              selectedKeys={[preset]}
              onSelectionChange={(keys) => {
                const nextPreset = Array.from(keys)[0];
                if (
                  nextPreset === "currentFy" ||
                  nextPreset === "currentQuarter" ||
                  nextPreset === "custom"
                ) {
                  applyPreset(nextPreset);
                }
              }}
              variant="bordered"
            >
              {presetOptions.map((option) => (
                <SelectItem key={option.key}>{option.label}</SelectItem>
              ))}
            </Select>

            <Input
              label={t("reports.from")}
              type="date"
              value={from}
              onValueChange={(value) => {
                setPreset("custom");
                setPreview(null);
                setPreviewError(null);
                setFrom(value);
              }}
              variant="bordered"
            />

            <Input
              label={t("reports.to")}
              type="date"
              value={to}
              onValueChange={(value) => {
                setPreset("custom");
                setPreview(null);
                setPreviewError(null);
                setTo(value);
              }}
              variant="bordered"
            />
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card shadow="sm">
          <CardBody className="space-y-3 p-6">
            <div>
              <h3 className="text-lg font-semibold">{t("reports.transactionRegister")}</h3>
              <p className="text-sm text-default-500">{t("reports.transactionDesc")}</p>
            </div>
            <Button
              color="primary"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold"
              isDisabled={exportBlocked}
              onPress={() => downloadFile(transactionUrl)}
            >
              {t("reports.downloadCSV")}
            </Button>
          </CardBody>
        </Card>

        <Card shadow="sm">
          <CardBody className="space-y-3 p-6">
            <div>
              <h3 className="text-lg font-semibold">{t("reports.trialBalance")}</h3>
              <p className="text-sm text-default-500">{t("reports.trialBalanceDesc")}</p>
            </div>
            <Button
              color="primary"
              variant="flat"
              isDisabled={exportBlocked}
              onPress={() => downloadFile(trialBalanceUrl)}
            >
              {t("reports.downloadCSV")}
            </Button>
          </CardBody>
        </Card>

        <Card shadow="sm">
          <CardBody className="space-y-3 p-6">
            <div>
              <h3 className="text-lg font-semibold">{t("reports.partyLedger")}</h3>
              <p className="text-sm text-default-500">{t("reports.partyLedgerDesc")}</p>
            </div>
            <Select
              label={t("reports.selectParty")}
              selectedKeys={selectedPartyId ? [selectedPartyId] : []}
              onSelectionChange={(keys) => {
                const nextValue = Array.from(keys)[0];
                if (typeof nextValue === "string") {
                  setSelectedPartyId(nextValue);
                }
              }}
              variant="bordered"
            >
              {parties.map((party) => (
                <SelectItem key={party.id} textValue={`${party.name} (${party.type.toLowerCase()})`}>

                  {party.name} ({party.type.toLowerCase()})
                </SelectItem>
              ))}
            </Select>
            <Button
              color="primary"
              variant="flat"
              isDisabled={exportBlocked || !selectedPartyId}
              onPress={() => downloadFile(partyLedgerUrl)}
            >
              {t("reports.downloadCSV")}
            </Button>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card shadow="sm" className="border border-amber-500/20">
          <CardBody className="p-6 flex flex-col justify-between items-start gap-4">
            <div className="flex items-start gap-3 w-full">
              <div className="flex-1">
                <h3 className="text-lg font-semibold">{t("reports.tallyExport")}</h3>
                <p className="text-sm text-default-500 mt-1">{t("reports.tallyExportDesc")}</p>
              </div>
              <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                Tally
              </span>
            </div>
            <Button
              color="warning"
              className="bg-gradient-to-r from-[#f76000] to-[#7b5ef6] text-white font-semibold shadow-md w-full sm:w-auto"
              onPress={() => window.location.href = "/settings/tally-export"}
            >
              Send to CA →
            </Button>
          </CardBody>
        </Card>

        <Card shadow="sm" className="border border-amber-500/20">
          <CardBody className="p-6 flex flex-col justify-between items-start gap-4">
            <div className="flex items-start gap-3 w-full">
              <div className="flex-1">
                <h3 className="text-lg font-semibold">{t("reports.tallyImport")}</h3>
                <p className="text-sm text-default-500 mt-1">{t("reports.tallyImportDesc")}</p>
              </div>
              <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                Tally
              </span>
            </div>
            <Button
              color="warning"
              variant="flat"
              className="font-semibold w-full sm:w-auto"
              onPress={() => window.location.href = "/settings/tally-import"}
            >
              Start Import →
            </Button>
          </CardBody>
        </Card>
      </div>

      <Card shadow="sm">
        <CardBody className="space-y-4 p-6">
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
                  <Skeleton key={index} className="h-20 rounded-xl" />
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
        </CardBody>
      </Card>
    </div>
  );
}
