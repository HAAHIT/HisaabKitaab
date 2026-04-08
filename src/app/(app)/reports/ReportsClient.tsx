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

/**
 * Build a download URL by appending serialized query parameters to a path.
 *
 * @param path - The base path or endpoint (e.g., `/api/export/transactions`)
 * @param params - Key-value pairs to serialize into the query string; keys and values are URL-encoded
 * @returns The composed URL string: `path` followed by `?` and the URL-encoded query string. If `params` is empty the result ends with `?`
 */
function buildDownloadUrl(path: string, params: Record<string, string>) {
  const query = new URLSearchParams(params);
  return `${path}?${query.toString()}`;
}

/**
 * Opens the given URL in a new browser tab or window using a secure noopener/noreferrer opener.
 *
 * @param url - The absolute or relative URL to open
 */
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

/**
 * Render the reports dashboard for exporting/importing financial reports and previewing the trial balance.
 *
 * Disables export actions when there are unbalanced entries; lets the user choose a date range via presets
 * (current financial year, current quarter, or custom) or custom dates; provides CSV exports (transactions,
 * trial balance, optional party ledger), Tally XML export, and Tally XML import with import result details;
 * and fetches a trial balance preview for the selected period when exports are allowed.
 *
 * @param initialFrom - Initial start date (ISO yyyy-mm-dd) for the reporting period
 * @param initialTo - Initial end date (ISO yyyy-mm-dd) for the reporting period
 * @param totalEntries - Total number of ledger entries in the system (display only)
 * @param unbalancedCount - Number of unbalanced entries; when greater than zero, export actions are disabled
 * @param parties - List of selectable parties for party-ledger export; each item should have `id`, `name`, and `type`
 * @returns The rendered reports dashboard React element
 */
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
      setImportResult(data as TallyImportResult);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
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

      <Card shadow="sm" className="border border-amber-500/20">
        <CardBody className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h3 className="text-lg font-semibold">{t("reports.tallyExport")}</h3>
              <p className="text-sm text-default-500">{t("reports.tallyExportDesc")}</p>
            </div>
            <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              Tally
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr,auto]">
            <Select
              label={t("reports.tallyExportType")}
              selectedKeys={[tallyExportType]}
              onSelectionChange={(keys) => {
                const next = Array.from(keys)[0];
                if (next === "all" || next === "masters" || next === "vouchers") {
                  setTallyExportType(next);
                }
              }}
              variant="bordered"
            >
              <SelectItem key="all">{t("reports.tallyAll")}</SelectItem>
              <SelectItem key="masters">{t("reports.tallyMasters")}</SelectItem>
              <SelectItem key="vouchers">{t("reports.tallyVouchers")}</SelectItem>
            </Select>

            <div className="flex items-end">
              <Button
                color="warning"
                variant="flat"
                className="font-semibold"
                isDisabled={exportBlocked}
                onPress={() =>
                  downloadFile(
                    buildDownloadUrl("/api/export/tally-xml", {
                      from,
                      to,
                      type: tallyExportType,
                    })
                  )
                }
              >
                {t("reports.downloadXML")}
              </Button>
            </div>
          </div>

          <p className="text-xs text-default-400">{t("reports.tallyHelp")}</p>
        </CardBody>
      </Card>

      <Card shadow="sm" className="border border-amber-500/20">
        <CardBody className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h3 className="text-lg font-semibold">{t("reports.tallyImport")}</h3>
              <p className="text-sm text-default-500">{t("reports.tallyImportDesc")}</p>
            </div>
            <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              Tally
            </span>
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <input
                type="file"
                accept=".xml,text/xml,application/xml"
                className="w-full cursor-pointer rounded-xl border border-default-200 bg-default-50 px-3 py-2 text-sm file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-sm file:font-medium file:text-primary"
                onChange={(e) => {
                  setImportFile(e.target.files?.[0] ?? null);
                  setImportResult(null);
                  setImportError(null);
                }}
              />
            </div>
            <Button
              color="warning"
              variant="flat"
              className="font-semibold shrink-0"
              isDisabled={!importFile}
              isLoading={importing}
              onPress={handleImport}
            >
              Import
            </Button>
          </div>

          {importError && (
            <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
              {importError}
            </p>
          )}

          {importResult && (
            <div className="rounded-xl border border-success/20 bg-success/5 px-4 py-3 text-sm space-y-1">
              <p className="font-medium text-success">Import complete</p>
              <p className="text-default-500">
                {importResult.imported} vouchers imported · {importResult.skipped} skipped (duplicates) · {importResult.partiesCreated} parties created
                {importResult.failed > 0 && (
                  <span className="text-danger"> · {importResult.failed} failed</span>
                )}
              </p>
              {importResult.parseErrors.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-default-400">
                    {importResult.parseErrors.length} parse warning(s)
                  </summary>
                  <ul className="mt-1 space-y-0.5 text-xs text-default-500">
                    {importResult.parseErrors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </details>
              )}
              {importResult.importErrors.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-danger">
                    {importResult.importErrors.length} import error(s)
                  </summary>
                  <ul className="mt-1 space-y-0.5 text-xs text-danger/80">
                    {importResult.importErrors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </details>
              )}
            </div>
          )}

          <p className="text-xs text-default-400">{t("reports.tallyImportHelp")}</p>
        </CardBody>
      </Card>

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
