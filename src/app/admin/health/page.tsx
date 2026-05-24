"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SystemHealth } from "@/lib/admin-stats";

const fmtInt = (n: number) => new Intl.NumberFormat("en-IN").format(n);
const fmtDate = (s: string) =>
  new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function Card({ children, title }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "var(--sb-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</h2>
      <div style={{ background: "var(--sb-card)", border: "1px solid var(--sb-border)", borderRadius: 12, padding: 16 }}>
        {children}
      </div>
    </section>
  );
}

export default function HealthPage() {
  const [data, setData] = useState<SystemHealth | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats/health")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => setData(j.data))
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <div style={{ color: "crimson" }}>Failed: {error}</div>;
  if (!data) return <div style={{ color: "var(--sb-muted)" }}>Loading…</div>;

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>System health</h1>
      <p style={{ color: "var(--sb-muted)", marginBottom: 20, fontSize: 13 }}>
        DB row counts, failed imports, auth blocks, stale tenants.
      </p>

      <Card title="Database row counts">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
          {data.dbCounts.map((c) => (
            <div key={c.table} style={{ padding: 8 }}>
              <div style={{ fontSize: 11, color: "var(--sb-muted)" }}>{c.table}</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{fmtInt(c.count)}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title={`Unbalanced journal entries (${fmtInt(data.unbalancedJournals)})`}>
        {data.unbalancedByTenant.length === 0 ? (
          <div style={{ color: "var(--sb-muted)", fontSize: 13 }}>None.</div>
        ) : (
          <table style={{ width: "100%", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--sb-muted)" }}>
                <th style={{ padding: 6, fontSize: 11 }}>TENANT</th>
                <th style={{ padding: 6, fontSize: 11 }}>UNBALANCED</th>
              </tr>
            </thead>
            <tbody>
              {data.unbalancedByTenant.map((row) => (
                <tr key={row.tenantId} style={{ borderTop: "1px solid var(--sb-divider)" }}>
                  <td style={{ padding: 6 }}>
                    <Link href={`/admin/stats/tenants/${row.tenantId}`} style={{ color: "var(--sb-text)" }}>{row.tenantName}</Link>
                  </td>
                  <td style={{ padding: 6, color: "crimson", fontWeight: 600 }}>{fmtInt(row.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Import jobs">
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
          {data.importJobs.length === 0 ? (
            <span style={{ color: "var(--sb-muted)", fontSize: 13 }}>No jobs.</span>
          ) : data.importJobs.map((s) => (
            <div key={s.status}>
              <div style={{ fontSize: 11, color: "var(--sb-muted)" }}>{s.status}</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{fmtInt(s.count)}</div>
            </div>
          ))}
        </div>
        {data.failedImports.length > 0 && (
          <table style={{ width: "100%", fontSize: 12, marginTop: 8 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--sb-muted)" }}>
                <th style={{ padding: 6 }}>WHEN</th>
                <th style={{ padding: 6 }}>TENANT</th>
                <th style={{ padding: 6 }}>STAGE</th>
                <th style={{ padding: 6 }}>FAILED</th>
                <th style={{ padding: 6 }}>ERROR</th>
              </tr>
            </thead>
            <tbody>
              {data.failedImports.map((j) => (
                <tr key={j.id} style={{ borderTop: "1px solid var(--sb-divider)" }}>
                  <td style={{ padding: 6, whiteSpace: "nowrap" }}>{fmtDate(j.createdAt)}</td>
                  <td style={{ padding: 6 }}>
                    <Link href={`/admin/stats/tenants/${j.tenantId}`} style={{ color: "var(--sb-text)" }}>{j.tenantName}</Link>
                  </td>
                  <td style={{ padding: 6 }}>{j.stage}</td>
                  <td style={{ padding: 6 }}>{j.failed}</td>
                  <td style={{ padding: 6, color: "crimson", maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.error ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Auth & users">
        <div style={{ display: "flex", gap: 24 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--sb-muted)" }}>Active throttle blocks</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: data.authThrottleBlocks > 0 ? "crimson" : "var(--sb-text)" }}>{fmtInt(data.authThrottleBlocks)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--sb-muted)" }}>Inactive users</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{fmtInt(data.inactiveUsers)}</div>
          </div>
        </div>
      </Card>

      <Card title="Stale tenants (no activity in 60 days)">
        {data.staleTenants.length === 0 ? (
          <div style={{ color: "var(--sb-muted)", fontSize: 13 }}>None.</div>
        ) : (
          <table style={{ width: "100%", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--sb-muted)" }}>
                <th style={{ padding: 6, fontSize: 11 }}>TENANT</th>
                <th style={{ padding: 6, fontSize: 11 }}>CREATED</th>
              </tr>
            </thead>
            <tbody>
              {data.staleTenants.map((t) => (
                <tr key={t.id} style={{ borderTop: "1px solid var(--sb-divider)" }}>
                  <td style={{ padding: 6 }}>
                    <Link href={`/admin/stats/tenants/${t.id}`} style={{ color: "var(--sb-text)" }}>{t.name}</Link>
                  </td>
                  <td style={{ padding: 6, color: "var(--sb-muted)" }}>{fmtDate(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
