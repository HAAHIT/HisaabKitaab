"use client";

import { useEffect, useState } from "react";
import type { PlatformOverview } from "@/lib/admin-stats";

const fmtInt = (n: number) => new Intl.NumberFormat("en-IN").format(n);
const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      style={{
        background: "var(--sb-card)",
        border: "1px solid var(--sb-border)",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div style={{ fontSize: 12, color: "var(--sb-muted)", fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--sb-text)" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--sb-muted)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function TrendBars({ data, valueKey, label, color }: {
  data: Array<{ label: string } & Record<string, number | string>>;
  valueKey: string;
  label: string;
  color: string;
}) {
  const max = Math.max(...data.map((d) => Number(d[valueKey] ?? 0)), 1);
  return (
    <div
      style={{
        background: "var(--sb-card)",
        border: "1px solid var(--sb-border)",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--sb-text)", marginBottom: 12 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120 }}>
        {data.map((d) => {
          const v = Number(d[valueKey] ?? 0);
          const h = (v / max) * 100;
          return (
            <div key={String(d.label)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ fontSize: 10, color: "var(--sb-muted)" }}>{v > 0 ? fmtInt(v) : ""}</div>
              <div
                style={{
                  width: "100%",
                  height: `${h}%`,
                  minHeight: v > 0 ? 2 : 0,
                  background: color,
                  borderRadius: 4,
                }}
              />
              <div style={{ fontSize: 10, color: "var(--sb-muted)" }}>{String(d.label)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminStatsOverview() {
  const [data, setData] = useState<PlatformOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats/overview")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => setData(j.data))
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <div style={{ color: "crimson" }}>Failed to load: {error}</div>;
  if (!data) return <div style={{ color: "var(--sb-muted)" }}>Loading…</div>;

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Platform Overview</h1>
      <p style={{ color: "var(--sb-muted)", marginBottom: 20, fontSize: 13 }}>
        Cross-tenant telemetry for SoloBooks.
      </p>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: "var(--sb-muted)" }}>Tenants</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          <StatCard label="Total tenants" value={fmtInt(data.tenants.total)} sub={`${data.tenants.onboardingComplete} onboarded`} />
          <StatCard label="FREE plan" value={fmtInt(data.tenants.free)} />
          <StatCard label="PRO plan" value={fmtInt(data.tenants.pro)} />
          <StatCard label="New (7d)" value={fmtInt(data.tenants.newLast7d)} sub={`${data.tenants.newLast30d} in 30d`} />
          <StatCard label="Active (7d)" value={fmtInt(data.activity.activeTenants7d)} sub={`${data.activity.activeTenants30d} in 30d`} />
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: "var(--sb-muted)" }}>Users</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          <StatCard label="Total users" value={fmtInt(data.users.total)} sub={`${data.users.active} active`} />
          {data.users.byRole.map((r) => (
            <StatCard key={r.role} label={r.role} value={fmtInt(r.count)} />
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: "var(--sb-muted)" }}>Activity (last 30 days)</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          <StatCard label="Bills created" value={fmtInt(data.activity.billsLast30d)} />
          <StatCard label="Payments" value={fmtInt(data.activity.paymentsLast30d)} sub={fmtMoney(data.activity.paymentVolumeLast30d)} />
          <StatCard label="Journal entries" value={fmtInt(data.activity.journalEntriesLast30d)} />
          <StatCard label="Unbalanced entries" value={fmtInt(data.activity.unbalancedJournalEntries)} sub="all-time" />
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: "var(--sb-muted)" }}>All-time totals</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          <StatCard label="Bills" value={fmtInt(data.totals.bills)} />
          <StatCard label="Payments" value={fmtInt(data.totals.payments)} />
          <StatCard label="Parties" value={fmtInt(data.totals.parties)} />
          <StatCard label="Journal entries" value={fmtInt(data.totals.journalEntries)} />
          <StatCard label="Audit logs" value={fmtInt(data.totals.auditLogs)} />
          <StatCard label="Bank accounts" value={fmtInt(data.totals.bankAccounts)} />
          <StatCard label="Item catalog" value={fmtInt(data.totals.itemCatalog)} />
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        <TrendBars data={data.signupTrend} valueKey="count" label="Tenant signups (6 months)" color="#7c3aed" />
        <TrendBars data={data.volumeTrend} valueKey="bills" label="Bills per month (6 months)" color="#0ea5e9" />
        <TrendBars data={data.volumeTrend} valueKey="payments" label="Payments per month (6 months)" color="#10b981" />
      </section>
    </div>
  );
}
