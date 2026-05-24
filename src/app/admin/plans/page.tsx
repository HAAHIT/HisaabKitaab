"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PlanStats } from "@/lib/admin-stats";

const fmtInt = (n: number) => new Intl.NumberFormat("en-IN").format(n);
const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

export default function PlansPage() {
  const [data, setData] = useState<PlanStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats/plans")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => setData(j.data))
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <div style={{ color: "crimson" }}>Failed: {error}</div>;
  if (!data) return <div style={{ color: "var(--sb-muted)" }}>Loading…</div>;

  const totalDist = data.distribution.reduce((s, d) => s + d.count, 0) || 1;

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Plans & revenue</h1>
      <p style={{ color: "var(--sb-muted)", marginBottom: 20, fontSize: 13 }}>
        Plan distribution, signups by plan, churn risk.
      </p>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "var(--sb-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Distribution</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          {data.distribution.map((d) => (
            <div key={d.plan} style={{ background: "var(--sb-card)", border: "1px solid var(--sb-border)", borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 12, color: "var(--sb-muted)", fontWeight: 600 }}>{d.plan}</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtInt(d.count)}</div>
              <div style={{ fontSize: 11, color: "var(--sb-muted)" }}>{Math.round((d.count / totalDist) * 100)}%</div>
            </div>
          ))}
          <div style={{ background: "var(--sb-card)", border: "1px solid var(--sb-border)", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, color: "var(--sb-muted)", fontWeight: 600 }}>PRO active 30d</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtInt(data.totals.proWithActivityLast30d)}</div>
            <div style={{ fontSize: 11, color: "var(--sb-muted)" }}>of {fmtInt(data.totals.proTenants)} PRO</div>
          </div>
          <div style={{ background: "var(--sb-card)", border: "1px solid var(--sb-border)", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, color: "var(--sb-muted)", fontWeight: 600 }}>FREE active 30d</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtInt(data.totals.freeWithActivityLast30d)}</div>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "var(--sb-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Signups by plan (6 months)</h2>
        <div style={{ background: "var(--sb-card)", border: "1px solid var(--sb-border)", borderRadius: 12, padding: 16 }}>
          <table style={{ width: "100%", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--sb-muted)" }}>
                <th style={{ padding: 6 }}>MONTH</th>
                <th style={{ padding: 6 }}>FREE</th>
                <th style={{ padding: 6 }}>PRO</th>
                <th style={{ padding: 6 }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {data.conversionTrend.map((t) => (
                <tr key={t.label} style={{ borderTop: "1px solid var(--sb-divider)" }}>
                  <td style={{ padding: 6 }}>{t.label}</td>
                  <td style={{ padding: 6 }}>{fmtInt(t.free)}</td>
                  <td style={{ padding: 6, color: "#7c3aed", fontWeight: 600 }}>{fmtInt(t.pro)}</td>
                  <td style={{ padding: 6 }}>{fmtInt(t.free + t.pro)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "var(--sb-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Recent PRO signups</h2>
        <div style={{ background: "var(--sb-card)", border: "1px solid var(--sb-border)", borderRadius: 12, overflow: "auto" }}>
          <table style={{ width: "100%", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--sb-surface-alt)", textAlign: "left" }}>
                <th style={{ padding: "8px 12px", fontSize: 11, color: "var(--sb-muted)" }}>TENANT</th>
                <th style={{ padding: "8px 12px", fontSize: 11, color: "var(--sb-muted)" }}>CREATED</th>
              </tr>
            </thead>
            <tbody>
              {data.recentUpgrades.length === 0 ? (
                <tr><td colSpan={2} style={{ padding: 16, textAlign: "center", color: "var(--sb-muted)" }}>None</td></tr>
              ) : data.recentUpgrades.map((t) => (
                <tr key={t.id} style={{ borderTop: "1px solid var(--sb-divider)" }}>
                  <td style={{ padding: "8px 12px" }}>
                    <Link href={`/admin/stats/tenants/${t.id}`} style={{ color: "var(--sb-text)", fontWeight: 600 }}>{t.name}</Link>
                  </td>
                  <td style={{ padding: "8px 12px", color: "var(--sb-muted)" }}>{fmtDate(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "var(--sb-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Churn risk (no bills in 60+ days)</h2>
        <div style={{ background: "var(--sb-card)", border: "1px solid var(--sb-border)", borderRadius: 12, overflow: "auto" }}>
          <table style={{ width: "100%", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--sb-surface-alt)", textAlign: "left" }}>
                <th style={{ padding: "8px 12px", fontSize: 11, color: "var(--sb-muted)" }}>TENANT</th>
                <th style={{ padding: "8px 12px", fontSize: 11, color: "var(--sb-muted)" }}>PLAN</th>
                <th style={{ padding: "8px 12px", fontSize: 11, color: "var(--sb-muted)" }}>CREATED</th>
                <th style={{ padding: "8px 12px", fontSize: 11, color: "var(--sb-muted)" }}>LAST BILL</th>
              </tr>
            </thead>
            <tbody>
              {data.churnRisk.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: 16, textAlign: "center", color: "var(--sb-muted)" }}>None</td></tr>
              ) : data.churnRisk.map((t) => (
                <tr key={t.id} style={{ borderTop: "1px solid var(--sb-divider)" }}>
                  <td style={{ padding: "8px 12px" }}>
                    <Link href={`/admin/stats/tenants/${t.id}`} style={{ color: "var(--sb-text)", fontWeight: 600 }}>{t.name}</Link>
                  </td>
                  <td style={{ padding: "8px 12px" }}>{t.plan}</td>
                  <td style={{ padding: "8px 12px", color: "var(--sb-muted)" }}>{fmtDate(t.createdAt)}</td>
                  <td style={{ padding: "8px 12px", color: "var(--sb-muted)" }}>{fmtDate(t.lastActivity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
