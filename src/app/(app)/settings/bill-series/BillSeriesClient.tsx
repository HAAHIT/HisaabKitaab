"use client";

import { useEffect, useState } from "react";
import { HKButton } from "@/components/ui/HKButton";
import { HKInput } from "@/components/ui/HKInput";
import { HKSkeleton } from "@/components/ui/HKSkeleton";

interface BillSeries {
  id: string;
  name: string;
  prefix: string;
  isDefault: boolean;
}

export default function BillSeriesClient() {
  const [series, setSeries] = useState<BillSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/bill-series")
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json?.error || "Failed to load");
        return json.data as BillSeries[];
      })
      .then((data) => {
        setSeries(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load");
        setLoading(false);
      });
  }, []);

  function update(idx: number, patch: Partial<BillSeries>) {
    setSeries((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, ...patch } : s))
    );
  }

  function setDefault(idx: number) {
    setSeries((prev) =>
      prev.map((s, i) => ({ ...s, isDefault: i === idx }))
    );
  }

  function addSeries() {
    setSeries((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: "",
        prefix: "",
        isDefault: prev.length === 0,
      },
    ]);
  }

  function removeSeries(idx: number) {
    setSeries((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (next.length > 0 && !next.some((s) => s.isDefault)) {
        next[0].isDefault = true;
      }
      return next;
    });
  }

  async function save() {
    setError(null);
    setInfo(null);
    setSaving(true);
    try {
      const res = await fetch("/api/bill-series", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ series }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to save");
      setSeries(json.data);
      setInfo("Saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="animate-fade-in p-4 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bill Number Series</h1>
        <p className="mt-1 text-sm text-default-500">
          Define multiple invoice number prefixes — for example one series for Tax Invoices and another for
          Bills of Supply. Bill numbers will use the selected series&apos; prefix followed by the IST year-month and a
          monthly sequence (e.g. <span className="font-mono">INV-202605-001</span>).
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--sb-border)] bg-[var(--sb-card)] shadow-sm p-6 space-y-4">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <HKSkeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            {error && (
              <div className="rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
                {error}
              </div>
            )}
            {info && (
              <div className="rounded-xl border border-success/30 bg-success/5 p-3 text-sm text-success-700">
                {info}
              </div>
            )}

            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-default-500 uppercase tracking-wide border-b border-divider">
                  <th className="py-2 pr-3 text-left font-semibold">Name</th>
                  <th className="py-2 pr-3 text-left font-semibold">Prefix</th>
                  <th className="py-2 pr-3 text-center font-semibold">Default</th>
                  <th className="py-2 text-right font-semibold w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {series.map((s, idx) => (
                  <tr key={s.id} className="border-b border-divider/40">
                    <td className="py-2 pr-3">
                      <HKInput
                        value={s.name}
                        onValueChange={(v) => update(idx, { name: v })}
                        placeholder="e.g. Tax Invoice"
                        size="sm"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <HKInput
                        value={s.prefix}
                        onValueChange={(v) =>
                          update(idx, { prefix: v.toUpperCase() })
                        }
                        placeholder="e.g. INV"
                        size="sm"
                      />
                    </td>
                    <td className="py-2 pr-3 text-center">
                      <input
                        type="radio"
                        name="default-series"
                        checked={s.isDefault}
                        onChange={() => setDefault(idx)}
                        aria-label={`Set ${s.name || "this series"} as default`}
                        style={{ accentColor: "var(--sb-primary)" }}
                      />
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeSeries(idx)}
                        disabled={series.length <= 1}
                        title={
                          series.length <= 1
                            ? "At least one series is required."
                            : "Remove"
                        }
                        style={{
                          background: "transparent",
                          border: "none",
                          color: series.length <= 1 ? "var(--sb-sub)" : "var(--sb-danger, #dc2626)",
                          cursor: series.length <= 1 ? "not-allowed" : "pointer",
                          fontSize: 13,
                          fontWeight: 600,
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex items-center justify-between pt-2">
              <HKButton size="sm" variant="secondary" onClick={addSeries}>
                + Add series
              </HKButton>
              <HKButton onClick={save} isDisabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </HKButton>
            </div>

            <p className="text-xs text-default-500 pt-2">
              Prefix rules: 1–12 characters, A–Z, 0–9, hyphen, underscore, or slash. Prefixes must be unique.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
