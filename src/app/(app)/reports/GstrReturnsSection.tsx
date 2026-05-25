"use client";

import { useEffect, useMemo, useState } from "react";
import { HKButton } from "@/components/ui/HKButton";
import { HKSelect, HKSelectItem } from "@/components/ui/HKSelect";
import { HKSkeleton } from "@/components/ui/HKSkeleton";

interface Bucket {
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
}

interface Gstr3bSummary {
  fp: string;
  outward: {
    taxable: Bucket;
    zeroRated: Bucket;
    nilExempt: { taxableValue: number };
    rcmInward: Bucket;
    nonGst: { taxableValue: number };
  };
  interStateB2C: Array<{
    pos: string;
    placeName: string;
    taxableValue: number;
    igst: number;
  }>;
  itc: {
    available: { igst: number; cgst: number; sgst: number; cess: number };
    reversed: { igst: number; cgst: number; sgst: number; cess: number };
    net: { igst: number; cgst: number; sgst: number; cess: number };
  };
  payment: {
    igstPayable: number;
    cgstPayable: number;
    sgstPayable: number;
    cessPayable: number;
  };
}

function inr(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function currentDefault(): { fyStartYear: number; fpMonth: number } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevMonthYear = month === 1 ? year - 1 : year;
  const fyStartYear = prevMonth >= 4 ? prevMonthYear : prevMonthYear - 1;
  return { fyStartYear, fpMonth: prevMonth };
}

export default function GstrReturnsSection() {
  const defaults = currentDefault();
  const [fpMonth, setFpMonth] = useState<number>(defaults.fpMonth);
  const [fpYear, setFpYear] = useState<number>(
    defaults.fpMonth >= 4 ? defaults.fyStartYear : defaults.fyStartYear + 1
  );

  const fyStartYear = useMemo(() => (fpMonth >= 4 ? fpYear : fpYear - 1), [fpMonth, fpYear]);

  const [summary, setSummary] = useState<Gstr3bSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"3.1" | "3.2" | "4" | "6.1">("3.1");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(
      `/api/reports/gstr3b?fyStartYear=${fyStartYear}&fpMonth=${fpMonth}`,
      { signal: controller.signal }
    )
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load");
        return json.data;
      })
      .then((data) => {
        setSummary(data);
        setLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load");
        setLoading(false);
      });

    return () => controller.abort();
  }, [fyStartYear, fpMonth]);

  const downloadGstr1 = () => {
    const url = `/api/reports/gstr1/json?fyStartYear=${fyStartYear}&fpMonth=${fpMonth}&download=1`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const yearOptions = (() => {
    const ist = currentDefault();
    const baseYear = ist.fpMonth >= 4 ? ist.fyStartYear + 1 : ist.fyStartYear + 1;
    return Array.from({ length: 5 }, (_, i) => baseYear - i);
  })();

  return (
    <div className="rounded-2xl border border-[var(--sb-border)] bg-[var(--sb-card)] shadow-sm">
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold">GST Returns (GSTR-1 & GSTR-3B)</h2>
            <p className="text-sm text-default-500 mt-0.5">
              Filing-period summary in the official GSTN format. Download the JSON files and upload to gst.gov.in.
            </p>
          </div>
          <div className="flex gap-2">
            <HKButton size="sm" variant="secondary" onClick={downloadGstr1}>
              Download GSTR-1 JSON
            </HKButton>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[200px,200px,1fr] items-end">
          <HKSelect
            label="Month"
            value={String(fpMonth)}
            onValueChange={(v) => setFpMonth(parseInt(v, 10))}
          >
            {MONTHS.map((m, idx) => (
              <HKSelectItem key={idx} value={String(idx + 1)}>
                {m}
              </HKSelectItem>
            ))}
          </HKSelect>
          <HKSelect
            label="Year"
            value={String(fpYear)}
            onValueChange={(v) => setFpYear(parseInt(v, 10))}
          >
            {yearOptions.map((y) => (
              <HKSelectItem key={y} value={String(y)}>
                {y}
              </HKSelectItem>
            ))}
          </HKSelect>
        </div>

        <div className="flex gap-2 border-b border-divider pb-1 overflow-x-auto">
          {(["3.1", "3.2", "4", "6.1"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-3 py-1.5 text-sm font-semibold rounded-t transition-colors whitespace-nowrap ${
                tab === k
                  ? "border-b-2 border-primary text-primary bg-primary/5"
                  : "text-default-500 hover:text-foreground"
              }`}
            >
              {k === "3.1"
                ? "3.1 Outward & RCM"
                : k === "3.2"
                ? "3.2 Inter-State B2C"
                : k === "4"
                ? "4 ITC"
                : "6.1 Tax Payable"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid gap-2">
            {[1, 2, 3].map((i) => (
              <HKSkeleton key={i} className="h-10 rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : !summary ? (
          <p className="text-sm text-default-500">No data.</p>
        ) : tab === "3.1" ? (
          <Section31 summary={summary} />
        ) : tab === "3.2" ? (
          <Section32 summary={summary} />
        ) : tab === "4" ? (
          <Section4 summary={summary} />
        ) : (
          <Section61 summary={summary} />
        )}
      </div>
    </div>
  );
}

function Section31({ summary }: { summary: Gstr3bSummary }) {
  const rows: Array<{
    label: string;
    taxable: number;
    igst: number;
    cgst: number;
    sgst: number;
  }> = [
    {
      label: "(a) Outward taxable supplies (other than zero-rated, nil-rated, exempted)",
      taxable: summary.outward.taxable.taxableValue,
      igst: summary.outward.taxable.igst,
      cgst: summary.outward.taxable.cgst,
      sgst: summary.outward.taxable.sgst,
    },
    {
      label: "(b) Outward taxable supplies (zero rated)",
      taxable: summary.outward.zeroRated.taxableValue,
      igst: summary.outward.zeroRated.igst,
      cgst: 0,
      sgst: 0,
    },
    {
      label: "(c) Other outward supplies (nil rated, exempted)",
      taxable: summary.outward.nilExempt.taxableValue,
      igst: 0,
      cgst: 0,
      sgst: 0,
    },
    {
      label: "(d) Inward supplies (liable to reverse charge)",
      taxable: summary.outward.rcmInward.taxableValue,
      igst: summary.outward.rcmInward.igst,
      cgst: summary.outward.rcmInward.cgst,
      sgst: summary.outward.rcmInward.sgst,
    },
    {
      label: "(e) Non-GST outward supplies",
      taxable: summary.outward.nonGst.taxableValue,
      igst: 0,
      cgst: 0,
      sgst: 0,
    },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-divider text-xs text-default-500 uppercase tracking-wide">
            <th className="py-2 pr-3 text-left font-semibold">Nature of Supplies</th>
            <th className="py-2 pr-3 text-right font-semibold">Total Taxable Value</th>
            <th className="py-2 pr-3 text-right font-semibold">IGST</th>
            <th className="py-2 pr-3 text-right font-semibold">CGST</th>
            <th className="py-2 text-right font-semibold">SGST</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-divider/40 hover:bg-default-50">
              <td className="py-2 pr-3">{r.label}</td>
              <td className="py-2 pr-3 text-right">{inr(r.taxable)}</td>
              <td className="py-2 pr-3 text-right">{r.igst > 0 ? inr(r.igst) : "—"}</td>
              <td className="py-2 pr-3 text-right">{r.cgst > 0 ? inr(r.cgst) : "—"}</td>
              <td className="py-2 text-right">{r.sgst > 0 ? inr(r.sgst) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section32({ summary }: { summary: Gstr3bSummary }) {
  if (summary.interStateB2C.length === 0) {
    return (
      <p className="text-sm text-default-500 py-4 text-center">
        No inter-state B2C (unregistered) supplies in this period.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-divider text-xs text-default-500 uppercase tracking-wide">
            <th className="py-2 pr-3 text-left font-semibold">Place of Supply</th>
            <th className="py-2 pr-3 text-right font-semibold">Total Taxable Value</th>
            <th className="py-2 text-right font-semibold">IGST</th>
          </tr>
        </thead>
        <tbody>
          {summary.interStateB2C.map((b) => (
            <tr key={b.pos} className="border-b border-divider/40 hover:bg-default-50">
              <td className="py-2 pr-3">
                <span className="font-mono">{b.pos}</span> — {b.placeName}
              </td>
              <td className="py-2 pr-3 text-right">{inr(b.taxableValue)}</td>
              <td className="py-2 text-right">{inr(b.igst)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section4({ summary }: { summary: Gstr3bSummary }) {
  const rows = [
    { label: "(A) ITC Available", v: summary.itc.available },
    { label: "(B) ITC Reversed", v: summary.itc.reversed },
    { label: "(C) Net ITC Available (A − B)", v: summary.itc.net },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-divider text-xs text-default-500 uppercase tracking-wide">
            <th className="py-2 pr-3 text-left font-semibold">Details</th>
            <th className="py-2 pr-3 text-right font-semibold">IGST</th>
            <th className="py-2 pr-3 text-right font-semibold">CGST</th>
            <th className="py-2 text-right font-semibold">SGST</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr
              key={r.label}
              className={`border-b border-divider/40 ${
                idx === rows.length - 1 ? "font-bold bg-default-50" : ""
              }`}
            >
              <td className="py-2 pr-3">{r.label}</td>
              <td className="py-2 pr-3 text-right">{r.v.igst > 0 ? inr(r.v.igst) : "—"}</td>
              <td className="py-2 pr-3 text-right">{r.v.cgst > 0 ? inr(r.v.cgst) : "—"}</td>
              <td className="py-2 text-right">{r.v.sgst > 0 ? inr(r.v.sgst) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section61({ summary }: { summary: Gstr3bSummary }) {
  const total =
    summary.payment.igstPayable +
    summary.payment.cgstPayable +
    summary.payment.sgstPayable +
    summary.payment.cessPayable;
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-divider text-xs text-default-500 uppercase tracking-wide">
              <th className="py-2 pr-3 text-left font-semibold">Tax Head</th>
              <th className="py-2 text-right font-semibold">Net Tax Payable</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-divider/40">
              <td className="py-2 pr-3">IGST</td>
              <td className="py-2 text-right">{inr(summary.payment.igstPayable)}</td>
            </tr>
            <tr className="border-b border-divider/40">
              <td className="py-2 pr-3">CGST</td>
              <td className="py-2 text-right">{inr(summary.payment.cgstPayable)}</td>
            </tr>
            <tr className="border-b border-divider/40">
              <td className="py-2 pr-3">SGST</td>
              <td className="py-2 text-right">{inr(summary.payment.sgstPayable)}</td>
            </tr>
            <tr className="border-t-2 border-divider bg-default-50 font-bold">
              <td className="py-2.5 pr-3">Total Tax Payable</td>
              <td className="py-2.5 text-right">{inr(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-default-500">
        Net tax payable = Output GST − Eligible ITC. If ITC exceeds output GST in a head, the excess carries
        forward (shown as zero here).
      </p>
    </div>
  );
}
