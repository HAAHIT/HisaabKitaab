"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { GlobalSearchResult } from "@/lib/admin-stats";

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export default function GlobalSearchPage() {
  const [q, setQ] = useState("");
  const [data, setData] = useState<GlobalSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setData(null);
      return;
    }
    const t = setTimeout(() => {
      setLoading(true);
      setError(null);
      fetch(`/api/admin/stats/search?q=${encodeURIComponent(q.trim())}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((j) => setData(j.data))
        .catch((e) => setError(String(e)))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const sectionStyle: React.CSSProperties = {
    background: "var(--sb-card)",
    border: "1px solid var(--sb-border)",
    borderRadius: 12,
    marginBottom: 16,
    overflow: "auto",
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Global search</h1>
      <p style={{ color: "var(--sb-muted)", marginBottom: 16, fontSize: 13 }}>
        Search across all tenants — tenants, parties, bills, users.
      </p>

      <input
        autoFocus
        type="search"
        placeholder="Name, GSTIN, phone, email, bill number…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{
          background: "var(--sb-card)",
          border: "1px solid var(--sb-border)",
          borderRadius: 8,
          padding: "10px 14px",
          fontSize: 14,
          color: "var(--sb-text)",
          width: "100%",
          maxWidth: 560,
          marginBottom: 20,
        }}
      />

      {error && <div style={{ color: "crimson", marginBottom: 12 }}>Failed: {error}</div>}
      {loading && <div style={{ color: "var(--sb-muted)", fontSize: 13 }}>Searching…</div>}

      {data && (
        <>
          <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--sb-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Tenants ({data.tenants.length})
          </h2>
          <div style={sectionStyle}>
            <table style={{ width: "100%", fontSize: 13 }}>
              <tbody>
                {data.tenants.length === 0 ? (
                  <tr><td style={{ padding: 12, color: "var(--sb-muted)" }}>No tenants matched.</td></tr>
                ) : data.tenants.map((t) => (
                  <tr key={t.id} style={{ borderTop: "1px solid var(--sb-divider)" }}>
                    <td style={{ padding: "8px 12px" }}>
                      <Link href={`/admin/stats/tenants/${t.id}`} style={{ fontWeight: 600, color: "var(--sb-text)" }}>{t.name}</Link>
                      <span style={{ color: "var(--sb-muted)", marginLeft: 8 }}>{t.slug} · {t.plan}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--sb-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Parties ({data.parties.length})
          </h2>
          <div style={sectionStyle}>
            <table style={{ width: "100%", fontSize: 13 }}>
              <tbody>
                {data.parties.length === 0 ? (
                  <tr><td style={{ padding: 12, color: "var(--sb-muted)" }}>No parties matched.</td></tr>
                ) : data.parties.map((p) => (
                  <tr key={p.id} style={{ borderTop: "1px solid var(--sb-divider)" }}>
                    <td style={{ padding: "8px 12px" }}>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: "var(--sb-muted)" }}>
                        {p.type} · {p.gstin ?? "no GSTIN"} · in <Link href={`/admin/stats/tenants/${p.tenantId}`} style={{ color: "var(--sb-text)" }}>{p.tenantName}</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--sb-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Bills ({data.bills.length})
          </h2>
          <div style={sectionStyle}>
            <table style={{ width: "100%", fontSize: 13 }}>
              <tbody>
                {data.bills.length === 0 ? (
                  <tr><td style={{ padding: 12, color: "var(--sb-muted)" }}>No bills matched.</td></tr>
                ) : data.bills.map((b) => (
                  <tr key={b.id} style={{ borderTop: "1px solid var(--sb-divider)" }}>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{b.billNumber}</span>
                      <span style={{ marginLeft: 8 }}>{b.customerName}</span>
                      <span style={{ marginLeft: 8, color: "var(--sb-muted)" }}>{fmtMoney(b.grandTotal)}</span>
                      <span style={{ marginLeft: 8, fontSize: 11, color: "var(--sb-muted)" }}>
                        · in <Link href={`/admin/stats/tenants/${b.tenantId}`} style={{ color: "var(--sb-text)" }}>{b.tenantName}</Link>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--sb-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Users ({data.users.length})
          </h2>
          <div style={sectionStyle}>
            <table style={{ width: "100%", fontSize: 13 }}>
              <tbody>
                {data.users.length === 0 ? (
                  <tr><td style={{ padding: 12, color: "var(--sb-muted)" }}>No users matched.</td></tr>
                ) : data.users.map((u) => (
                  <tr key={u.id} style={{ borderTop: "1px solid var(--sb-divider)" }}>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ fontWeight: 600 }}>{u.name}</span>
                      <span style={{ marginLeft: 8, color: "var(--sb-muted)" }}>{u.email ?? "—"}</span>
                      <span style={{ marginLeft: 8, fontSize: 11, color: "var(--sb-muted)" }}>
                        · {u.role} · in <Link href={`/admin/stats/tenants/${u.tenantId}`} style={{ color: "var(--sb-text)" }}>{u.tenantName}</Link>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
