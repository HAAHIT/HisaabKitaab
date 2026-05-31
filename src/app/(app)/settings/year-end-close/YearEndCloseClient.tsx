"use client";

import { useEffect, useState } from "react";
import { HKButton } from "@/components/ui/HKButton";
import { HKSelect, HKSelectItem } from "@/components/ui/HKSelect";
import { HKSkeleton } from "@/components/ui/HKSkeleton";
import { HKModal } from "@/components/ui/hk-design";
import { Input } from "@heroui/react";

interface PreviewLine {
  accountCode: string;
  accountName: string;
  type: "INCOME" | "EXPENSE";
  balance: number;
}

interface Preview {
  fyStartYear: number;
  fyLabel: string;
  incomeLines: PreviewLine[];
  expenseLines: PreviewLine[];
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  alreadyClosed: boolean;
}

function inr(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function currentFyStartYear(): number {
  const now = new Date();
  const istParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const year = Number(istParts.find((p) => p.type === "year")?.value);
  const month = Number(istParts.find((p) => p.type === "month")?.value);
  return month >= 4 ? year : year - 1;
}

export default function YearEndCloseClient() {
  const current = currentFyStartYear();
  const [fyStartYear, setFyStartYear] = useState<number>(current - 1);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [closedYears, setClosedYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const yearOptions = Array.from({ length: 6 }, (_, i) => current - i);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setSuccess(null);

    fetch(`/api/year-end-close?fyStartYear=${fyStartYear}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load");
        return json.data;
      })
      .then((data) => {
        setPreview(data.preview);
        setClosedYears(data.closedYears);
        setLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load");
        setLoading(false);
      });

    return () => controller.abort();
  }, [fyStartYear]);

  function openConfirm() {
    setConfirmText("");
    setConfirmOpen(true);
  }

  async function handleClose() {
    if (!preview) return;
    if (confirmText.trim() !== preview.fyLabel) return;
    setConfirmOpen(false);

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/year-end-close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fyStartYear }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to close");
      setSuccess(
        `${preview.fyLabel} closed. Journal entry ${json.data.journalId} created with net ${
          json.data.netProfit >= 0 ? "profit" : "loss"
        } of ${inr(Math.abs(json.data.netProfit))}.`
      );
      // Refresh preview
      const refreshRes = await fetch(`/api/year-end-close?fyStartYear=${fyStartYear}`);
      const refreshJson = await refreshRes.json();
      setPreview(refreshJson.data.preview);
      setClosedYears(refreshJson.data.closedYears);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="animate-fade-in p-4 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Year-End Close</h1>
        <p className="mt-1 text-sm text-default-500">
          Posts a closing journal entry that zeroes out income and expense accounts for the selected financial
          year and transfers net profit/loss to Capital Account. Once closed, the FY cannot be re-closed.
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--sb-border)] bg-[var(--sb-card)] shadow-sm p-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-[280px,1fr] items-end">
          <HKSelect
            label="Financial Year"
            value={String(fyStartYear)}
            onValueChange={(v) => setFyStartYear(parseInt(v, 10))}
          >
            {yearOptions.map((y) => (
              <HKSelectItem key={y} value={String(y)}>
                FY {y}-{String(y + 1).slice(-2)}
                {closedYears.includes(y) ? " (closed)" : ""}
              </HKSelectItem>
            ))}
          </HKSelect>
          {preview && (
            <HKButton
              isDisabled={preview.alreadyClosed || submitting}
              onClick={openConfirm}
            >
              {submitting
                ? "Closing…"
                : preview.alreadyClosed
                ? "Already Closed"
                : `Close ${preview.fyLabel}`}
            </HKButton>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-success/30 bg-success/5 p-3 text-sm text-success-700">
            {success}
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <HKSkeleton key={i} className="h-10 rounded-xl" />
            ))}
          </div>
        ) : preview ? (
          <div className="space-y-6">
            {preview.alreadyClosed && (
              <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm text-warning-700">
                This FY is already closed. The closing journal entry exists in the books.
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              <PreviewTable
                title="Income to zero out"
                lines={preview.incomeLines}
                total={preview.totalIncome}
              />
              <PreviewTable
                title="Expenses to zero out"
                lines={preview.expenseLines}
                total={preview.totalExpense}
              />
            </div>

            <div
              className={`rounded-xl border p-4 flex justify-between items-center ${
                preview.netProfit >= 0
                  ? "border-success/30 bg-success/5 text-success-700"
                  : "border-danger/30 bg-danger/5 text-danger-700"
              }`}
            >
              <span className="font-bold">
                {preview.netProfit >= 0 ? "Net Profit → Capital Account" : "Net Loss → Capital Account"}
              </span>
              <span className="font-bold text-lg">{inr(Math.abs(preview.netProfit))}</span>
            </div>
          </div>
        ) : null}
      </div>

      {preview && (
        <HKModal
          isOpen={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          title={`Confirm close of ${preview.fyLabel}`}
          footer={
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <HKButton variant="secondary" onClick={() => setConfirmOpen(false)} isDisabled={submitting}>
                Cancel
              </HKButton>
              <HKButton
                onClick={handleClose}
                isDisabled={confirmText.trim() !== preview.fyLabel || submitting}
                isLoading={submitting}
              >
                Close FY
              </HKButton>
            </div>
          }
        >
          <div className="space-y-3 text-sm">
            <p>
              This creates a permanent JOURNAL voucher transferring net{" "}
              <strong>{preview.netProfit >= 0 ? "profit" : "loss"}</strong> of{" "}
              <strong>{inr(Math.abs(preview.netProfit))}</strong> to the Capital Account.
              It cannot be undone via the UI.
            </p>
            <p>
              Type <strong>{preview.fyLabel}</strong> to confirm:
            </p>
            <Input
              autoFocus
              value={confirmText}
              onValueChange={setConfirmText}
              placeholder={preview.fyLabel}
              variant="bordered"
            />
          </div>
        </HKModal>
      )}
    </div>
  );
}

function PreviewTable({
  title,
  lines,
  total,
}: {
  title: string;
  lines: PreviewLine[];
  total: number;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-default-500 mb-2">
        {title}
      </h3>
      <table className="w-full text-sm">
        <tbody>
          {lines.length === 0 && (
            <tr>
              <td className="py-2 text-default-400 italic">No activity</td>
              <td className="py-2 text-right text-default-400">—</td>
            </tr>
          )}
          {lines.map((l) => (
            <tr key={l.accountCode} className="border-b border-divider/40">
              <td className="py-2 text-default-700">{l.accountName}</td>
              <td className="py-2 text-right">{inr(l.balance)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-divider font-bold">
            <td className="py-2">Total</td>
            <td className="py-2 text-right">{inr(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
