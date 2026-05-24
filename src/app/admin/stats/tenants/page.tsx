"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { TenantRow } from "@/lib/admin-stats";

const fmtInt = (n: number) => new Intl.NumberFormat("en-IN").format(n);
const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

export default function AdminTenantsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<TenantRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const limit = 50;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (search.trim()) params.set("search", search.trim());
    fetch(`/api/admin/stats/tenants?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => {
        setRows(j.data.rows);
        setTotal(j.data.total);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [search, offset]);

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Tenants</h1>
      <p style={{ color: "var(--sb-muted)", marginBottom: 16, fontSize: 13 }}>
        {fmtInt(total)} total · showing {rows.length}
      </p>

      <input
        type="search"
        placeholder="Search by name, slug, GSTIN…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOffset(0);
        }}
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
              {["Tenant", "Plan", "Users", "Parties", "Bills", "Payments", "Volume", "Unbal.", "Last activity", "Created"].map((h) => (
                <th key={h} style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--sb-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr><td colSpan={10} style={{ padding: 24, textAlign: "center", color: "var(--sb-muted)" }}>Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={10} style={{ padding: 24, textAlign: "center", color: "var(--sb-muted)" }}>No tenants</td></tr>
            ) : rows.map((t) => (
              <tr
                key={t.id}
                onClick={() => router.push(`/admin/stats/tenants/${t.id}`)}
                style={{ borderTop: "1px solid var(--sb-divider)", cursor: "pointer" }}
              >
                <td style={{ padding: "10px 12px" }}>
                  <div style={{ fontWeight: 600, color: "var(--sb-text)" }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: "var(--sb-muted)" }}>{t.slug}{!t.isOnboardingComplete && " · onboarding"}</div>
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: t.plan === "PRO" ? "#ede9fe" : "var(--sb-surface-alt)", color: t.plan === "PRO" ? "#6d28d9" : "var(--sb-text)" }}>{t.plan}</span>
                </td>
                <td style={{ padding: "10px 12px" }}>{fmtInt(t.userCount)}</td>
                <td style={{ padding: "10px 12px" }}>{fmtInt(t.partyCount)}</td>
                <td style={{ padding: "10px 12px" }}>{fmtInt(t.billCount)}</td>
                <td style={{ padding: "10px 12px" }}>{fmtInt(t.paymentCount)}</td>
                <td style={{ padding: "10px 12px" }}>{fmtMoney(t.paymentVolume)}</td>
                <td style={{ padding: "10px 12px", color: t.unbalancedEntries > 0 ? "crimson" : "var(--sb-muted)" }}>{fmtInt(t.unbalancedEntries)}</td>
                <td style={{ padding: "10px 12px", color: "var(--sb-muted)" }}>{fmtDate(t.lastActivityAt)}</td>
                <td style={{ padding: "10px 12px", color: "var(--sb-muted)" }}>{fmtDate(t.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, fontSize: 13 }}>
        <button
          onClick={() => setOffset(Math.max(0, offset - limit))}
          disabled={offset === 0}
          style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--sb-border)", background: "var(--sb-card)", cursor: offset === 0 ? "not-allowed" : "pointer", opacity: offset === 0 ? 0.5 : 1 }}
        >
          Previous
        </button>
        <span style={{ color: "var(--sb-muted)" }}>
          {offset + 1}–{Math.min(offset + rows.length, total)} of {total}
        </span>
        <button
          onClick={() => setOffset(offset + limit)}
          disabled={offset + rows.length >= total}
          style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--sb-border)", background: "var(--sb-card)", cursor: offset + rows.length >= total ? "not-allowed" : "pointer", opacity: offset + rows.length >= total ? 0.5 : 1 }}
        >
          Next
        </button>
      </div>
    </div>
  );
}
