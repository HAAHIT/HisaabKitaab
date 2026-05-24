"use client";

import { useEffect, useState } from "react";
import type { ActivityRow } from "@/lib/admin-stats";

const fmtDate = (s: string) =>
  new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function AdminActivityPage() {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [tenantFilter, setTenantFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "200" });
    if (tenantFilter.trim()) params.set("tenantId", tenantFilter.trim());
    fetch(`/api/admin/stats/activity?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => setRows(j.data))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [tenantFilter]);

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Recent activity</h1>
      <p style={{ color: "var(--sb-muted)", marginBottom: 16, fontSize: 13 }}>
        Audit log across all tenants — most recent first.
      </p>

      <input
        type="text"
        placeholder="Filter by tenant ID (optional)"
        value={tenantFilter}
        onChange={(e) => setTenantFilter(e.target.value)}
        style={{
          background: "var(--sb-card)",
          border: "1px solid var(--sb-border)",
          borderRadius: 8,
          padding: "8px 12px",
          fontSize: 13,
          color: "var(--sb-text)",
          width: 320,
          marginBottom: 16,
        }}
      />

      {error && <div style={{ color: "crimson", marginBottom: 12 }}>Failed: {error}</div>}

      <div
        style={{
          background: "var(--sb-card)",
          border: "1px solid var(--sb-border)",
          borderRadius: 12,
          overflow: "auto",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--sb-surface-alt)", textAlign: "left" }}>
              {["When", "Tenant", "Entity", "Action", "Actor", "User"].map((h) => (
                <th key={h} style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--sb-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--sb-muted)" }}>Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--sb-muted)" }}>No activity</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--sb-divider)" }}>
                <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: "var(--sb-muted)" }}>{fmtDate(r.createdAt)}</td>
                <td style={{ padding: "10px 12px" }}>
                  <div style={{ fontWeight: 600 }}>{r.tenantName}</div>
                  <div style={{ fontSize: 11, color: "var(--sb-muted)", fontFamily: "monospace" }}>{r.tenantId.slice(0, 12)}…</div>
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <div>{r.entityType}</div>
                  <div style={{ fontSize: 11, color: "var(--sb-muted)", fontFamily: "monospace" }}>{r.entityId.slice(0, 12)}…</div>
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: "var(--sb-surface-alt)" }}>{r.action}</span>
                </td>
                <td style={{ padding: "10px 12px", color: "var(--sb-muted)" }}>{r.actorType}</td>
                <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 11, color: "var(--sb-muted)" }}>{r.userId?.slice(0, 12) ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
