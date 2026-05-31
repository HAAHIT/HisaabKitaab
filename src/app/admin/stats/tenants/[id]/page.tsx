"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { TenantDetail } from "@/lib/admin-stats";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import { useConfirm } from "@/contexts/ConfirmContext";

const fmtInt = (n: number) => new Intl.NumberFormat("en-IN").format(n);
const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: "var(--sb-card)", border: "1px solid var(--sb-border)", borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 11, color: "var(--sb-muted)", fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--sb-text)" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--sb-muted)", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "var(--sb-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</h2>
      {children}
    </section>
  );
}

function EditTenantForm({
  tenant,
  busy,
  onSave,
}: {
  tenant: TenantDetail;
  busy: string | null;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const [name, setName] = useState(tenant.name);
  const [email, setEmail] = useState(tenant.email ?? "");
  const [phone, setPhone] = useState(tenant.phone ?? "");
  const [gstin, setGstin] = useState(tenant.gstin ?? "");

  useEffect(() => {
    setName(tenant.name);
    setEmail(tenant.email ?? "");
    setPhone(tenant.phone ?? "");
    setGstin(tenant.gstin ?? "");
  }, [tenant.id, tenant.name, tenant.email, tenant.phone, tenant.gstin]);

  const dirty =
    name !== tenant.name ||
    email !== (tenant.email ?? "") ||
    phone !== (tenant.phone ?? "") ||
    gstin !== (tenant.gstin ?? "");

  const inputStyle: React.CSSProperties = {
    background: "var(--sb-card)",
    border: "1px solid var(--sb-border)",
    borderRadius: 6,
    padding: "6px 10px",
    fontSize: 13,
    color: "var(--sb-text)",
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!dirty) return;
        onSave({ name, email, phone, gstin });
      }}
      style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, alignItems: "end" }}
    >
      <label style={{ fontSize: 11, color: "var(--sb-muted)", display: "grid", gap: 4 }}>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} required />
      </label>
      <label style={{ fontSize: 11, color: "var(--sb-muted)", display: "grid", gap: 4 }}>
        Email
        <input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} type="email" />
      </label>
      <label style={{ fontSize: 11, color: "var(--sb-muted)", display: "grid", gap: 4 }}>
        Phone
        <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
      </label>
      <label style={{ fontSize: 11, color: "var(--sb-muted)", display: "grid", gap: 4 }}>
        GSTIN
        <input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} style={inputStyle} maxLength={15} />
      </label>
      <button
        type="submit"
        disabled={!dirty || busy === "edit"}
        style={{
          padding: "6px 14px", borderRadius: 8, border: "none",
          background: dirty ? "var(--sb-primary)" : "var(--sb-surface-alt)",
          color: dirty ? "white" : "var(--sb-muted)",
          fontSize: 13, fontWeight: 600,
          cursor: dirty ? "pointer" : "not-allowed",
        }}
      >
        {busy === "edit" ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

async function jsonOrThrow(res: Response) {
  if (res.ok) return res.json();
  const j = await res.json().catch(() => ({}));
  throw new Error(j.error ?? `HTTP ${res.status}`);
}

export default function TenantDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const confirm = useConfirm();
  const id = params?.id;
  const [data, setData] = useState<TenantDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<{ userName: string; userId: string; userEmail: string | null; url: string; expiresAt: string; emailDelivered?: boolean; emailReason?: string } | null>(null);

  const load = () => {
    if (!id) return;
    fetch(`/api/admin/stats/tenants/${id}`)
      .then(jsonOrThrow)
      .then((j) => setData(j.data))
      .catch((e) => setError(String(e instanceof Error ? e.message : e)));
  };

  useEffect(load, [id]);

  const patchTenant = async (patch: Record<string, unknown>, label: string) => {
    if (!id) return;
    setBusy(label);
    setActionError(null);
    try {
      await jsonOrThrow(await fetch(`/api/admin/tenants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }));
      load();
    } catch (e) {
      setActionError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(null);
    }
  };

  const toggleUserActive = async (userId: string, next: boolean) => {
    setBusy(`user:${userId}`);
    setActionError(null);
    try {
      await jsonOrThrow(await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      }));
      load();
    } catch (e) {
      setActionError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(null);
    }
  };

  const issueReset = async (userId: string, userName: string, sendEmail: boolean) => {
    setBusy(`reset:${userId}`);
    setActionError(null);
    try {
      const j = await jsonOrThrow(await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendEmail }),
      }));
      setResetLink({
        userName,
        userId,
        userEmail: j.data.userEmail,
        url: j.data.resetUrl,
        expiresAt: j.data.expiresAt,
        emailDelivered: j.data.emailDelivered,
        emailReason: j.data.emailReason,
      });
    } catch (e) {
      setActionError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(null);
    }
  };

  const impersonate = async (userId: string, userName: string, readOnly: boolean) => {
    if (!id) return;
    const label = readOnly ? "read-only" : "with FULL ACCESS";
    if (!(await confirm({ title: "Impersonate user", message: `Sign in as ${userName} ${label}? You'll act as this user until you exit impersonation.`, confirmLabel: "Impersonate", intent: "danger" }))) return;
    setBusy(`imp:${userId}`);
    setActionError(null);
    try {
      const j = await jsonOrThrow(await fetch(`/api/admin/tenants/${id}/impersonate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, readOnly }),
      }));
      window.location.href = j.data.redirectTo ?? "/dashboard";
    } catch (e) {
      setActionError(String(e instanceof Error ? e.message : e));
      setBusy(null);
    }
  };

  const deleteTenant = async () => {
    if (!id || !data) return;
    const first = window.prompt(
      `This will PERMANENTLY DELETE tenant "${data.name}" and ALL its data (bills, payments, parties, users, audit logs).\n\nType the tenant name to confirm:`
    );
    if (first !== data.name) {
      if (first !== null) setActionError("Confirmation text did not match — aborted.");
      return;
    }
    setBusy("delete");
    setActionError(null);
    try {
      await jsonOrThrow(await fetch(`/api/admin/tenants/${id}`, { method: "DELETE" }));
      router.push("/admin/stats/tenants");
    } catch (e) {
      setActionError(String(e instanceof Error ? e.message : e));
      setBusy(null);
    }
  };

  const suspendAll = async (suspend: boolean) => {
    if (!id) return;
    if (!(await confirm({ message: suspend ? "Deactivate all non-superadmin users in this tenant?" : "Reactivate all users in this tenant?", confirmLabel: suspend ? "Deactivate" : "Reactivate", intent: suspend ? "danger" : "primary" }))) return;
    setBusy("suspend");
    setActionError(null);
    try {
      await jsonOrThrow(await fetch(`/api/admin/tenants/${id}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suspend }),
      }));
      load();
    } catch (e) {
      setActionError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(null);
    }
  };

  if (error) return <div style={{ color: "crimson" }}>Failed: {error}</div>;
  if (!data) return <div style={{ color: "var(--sb-muted)" }}>Loading…</div>;

  const anyUserActive = data.users.some((u) => u.isActive && u.role !== "SUPERADMIN");
  const otherPlan = data.plan === "PRO" ? "FREE" : "PRO";

  return (
    <div>
      <Link href="/admin/stats/tenants" style={{ fontSize: 13, color: "var(--sb-muted)" }}>← All tenants</Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "8px 0 4px" }}>{data.name}</h1>
      <p style={{ color: "var(--sb-muted)", marginBottom: 20, fontSize: 13 }}>
        {data.slug} · {data.plan} · created {fmtDate(data.createdAt)}
        {!data.isOnboardingComplete && " · onboarding incomplete"}
        {data.gstin && ` · ${data.gstin}`}
      </p>

      <Section title="Tenant actions">
        <div style={{ background: "var(--sb-card)", border: "1px solid var(--sb-border)", borderRadius: 12, padding: 16 }}>
          {actionError && (
            <div style={{ background: "#fef2f2", color: "crimson", padding: 8, borderRadius: 6, fontSize: 12, marginBottom: 12 }}>
              {actionError}
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            <button
              onClick={() => patchTenant({ plan: otherPlan }, "plan")}
              disabled={busy === "plan"}
              style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--sb-border)", background: "var(--sb-card)", fontSize: 13, cursor: "pointer" }}
            >
              {busy === "plan" ? "…" : `Switch to ${otherPlan}`}
            </button>
            <button
              onClick={() => suspendAll(anyUserActive)}
              disabled={busy === "suspend"}
              style={{
                padding: "6px 12px", borderRadius: 8,
                border: `1px solid ${anyUserActive ? "crimson" : "var(--sb-border)"}`,
                background: "var(--sb-card)",
                color: anyUserActive ? "crimson" : "var(--sb-text)",
                fontSize: 13, cursor: "pointer",
              }}
            >
              {busy === "suspend" ? "…" : anyUserActive ? "Suspend all users" : "Reactivate all users"}
            </button>
            {FEATURE_FLAGS.testingDeleteTenant && (
              <button
                onClick={deleteTenant}
                disabled={busy === "delete"}
                title="PERMANENTLY delete tenant + all data. Testing only."
                style={{
                  padding: "6px 12px", borderRadius: 8,
                  border: "1px solid #b91c1c",
                  background: "#b91c1c", color: "#fff",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}
              >
                {busy === "delete" ? "Deleting…" : "🗑 Delete tenant"}
              </button>
            )}
            {!data.isOnboardingComplete && (
              <button
                onClick={() => patchTenant({ isOnboardingComplete: true }, "onboarding")}
                disabled={busy === "onboarding"}
                style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--sb-border)", background: "var(--sb-card)", fontSize: 13, cursor: "pointer" }}
              >
                {busy === "onboarding" ? "…" : "Mark onboarding complete"}
              </button>
            )}
          </div>
          <EditTenantForm tenant={data} busy={busy} onSave={(patch) => patchTenant(patch, "edit")} />
        </div>
      </Section>

      {resetLink && (
        <div style={{ background: "#fef9c3", border: "1px solid #facc15", borderRadius: 12, padding: 16, marginBottom: 24 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Reset link for {resetLink.userName}</div>
          <div style={{ fontSize: 11, color: "var(--sb-muted)", marginBottom: 8 }}>
            Expires {fmtDateTime(resetLink.expiresAt)}. Share over a secure channel.
          </div>
          {resetLink.emailDelivered === true ? (
            <div style={{ fontSize: 12, color: "#15803d", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, padding: "6px 8px", marginBottom: 8 }}>
              ✓ Email sent to {resetLink.userEmail}. The link is not shown here for security.
            </div>
          ) : (
            <>
              {resetLink.emailDelivered === false && resetLink.emailReason && (
                <div style={{ fontSize: 12, color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "6px 8px", marginBottom: 8 }}>
                  Email not sent ({resetLink.emailReason}). Copy the link below and share it manually.
                </div>
              )}
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  readOnly
                  value={resetLink.url}
                  onFocus={(e) => e.currentTarget.select()}
                  style={{ flex: 1, fontFamily: "monospace", fontSize: 12, padding: 6, border: "1px solid var(--sb-border)", borderRadius: 6 }}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(resetLink.url);
                  }}
                  style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--sb-border)", background: "white", fontSize: 12, cursor: "pointer" }}
                >
                  Copy
                </button>
              </div>
            </>
          )}
          <button
            onClick={() => setResetLink(null)}
            style={{ marginTop: 8, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--sb-border)", background: "white", fontSize: 12, cursor: "pointer" }}
          >
            Dismiss
          </button>
        </div>
      )}

      <Section title="Last 30 days">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
          <StatCard label="Bills" value={fmtInt(data.last30d.bills)} />
          <StatCard label="Payments" value={fmtInt(data.last30d.payments)} sub={fmtMoney(data.last30d.paymentVolume)} />
        </div>
      </Section>

      <Section title="All-time">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
          <StatCard label="Users" value={fmtInt(data.counts.users)} />
          <StatCard label="Parties" value={fmtInt(data.counts.parties)} />
          <StatCard label="Bills" value={fmtInt(data.counts.bills)} />
          <StatCard label="Payments" value={fmtInt(data.counts.payments)} sub={fmtMoney(data.paymentVolume)} />
          <StatCard label="Journals" value={fmtInt(data.counts.journalEntries)} />
          <StatCard label="Bank accts" value={fmtInt(data.counts.bankAccounts)} />
          <StatCard label="Audit logs" value={fmtInt(data.counts.auditLogs)} />
          <StatCard label="Unbalanced" value={fmtInt(data.counts.unbalancedEntries)} />
        </div>
      </Section>

      <Section title="6-month trend">
        <div style={{ background: "var(--sb-card)", border: "1px solid var(--sb-border)", borderRadius: 12, padding: 16 }}>
          <table style={{ width: "100%", fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--sb-muted)" }}>
                <th style={{ padding: 6 }}>Month</th>
                <th style={{ padding: 6 }}>Bills</th>
                <th style={{ padding: 6 }}>Payments</th>
                <th style={{ padding: 6 }}>Volume</th>
              </tr>
            </thead>
            <tbody>
              {data.trend.map((t) => (
                <tr key={t.label} style={{ borderTop: "1px solid var(--sb-divider)" }}>
                  <td style={{ padding: 6 }}>{t.label}</td>
                  <td style={{ padding: 6 }}>{fmtInt(t.bills)}</td>
                  <td style={{ padding: 6 }}>{fmtInt(t.payments)}</td>
                  <td style={{ padding: 6 }}>{fmtMoney(t.paymentVolume)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title={`Users (${data.users.length})`}>
        <div style={{ background: "var(--sb-card)", border: "1px solid var(--sb-border)", borderRadius: 12, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--sb-surface-alt)", textAlign: "left" }}>
                <th style={{ padding: "8px 12px", fontSize: 11, color: "var(--sb-muted)" }}>NAME</th>
                <th style={{ padding: "8px 12px", fontSize: 11, color: "var(--sb-muted)" }}>EMAIL</th>
                <th style={{ padding: "8px 12px", fontSize: 11, color: "var(--sb-muted)" }}>ROLE</th>
                <th style={{ padding: "8px 12px", fontSize: 11, color: "var(--sb-muted)" }}>STATUS</th>
                <th style={{ padding: "8px 12px", fontSize: 11, color: "var(--sb-muted)" }}>JOINED</th>
                <th style={{ padding: "8px 12px", fontSize: 11, color: "var(--sb-muted)" }}></th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id} style={{ borderTop: "1px solid var(--sb-divider)" }}>
                  <td style={{ padding: "8px 12px", fontWeight: 600 }}>{u.name}</td>
                  <td style={{ padding: "8px 12px", color: "var(--sb-muted)" }}>{u.email ?? "—"}</td>
                  <td style={{ padding: "8px 12px" }}>{u.role}</td>
                  <td style={{ padding: "8px 12px", color: u.isActive ? "var(--sb-text)" : "var(--sb-muted)" }}>
                    {u.isActive ? "Active" : "Inactive"}
                  </td>
                  <td style={{ padding: "8px 12px", color: "var(--sb-muted)" }}>{fmtDate(u.createdAt)}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                    {u.role !== "SUPERADMIN" && (
                      <>
                        <button
                          onClick={() => toggleUserActive(u.id, !u.isActive)}
                          disabled={busy === `user:${u.id}`}
                          style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid var(--sb-border)", background: "var(--sb-card)", fontSize: 11, cursor: "pointer", marginRight: 6 }}
                        >
                          {busy === `user:${u.id}` ? "…" : u.isActive ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => issueReset(u.id, u.name, false)}
                          disabled={busy === `reset:${u.id}` || !u.email}
                          title={!u.email ? "User has no email" : "Generate reset link (copy/share manually)"}
                          style={{ padding: "3px 8px", borderRadius: "6px 0 0 6px", border: "1px solid var(--sb-border)", background: "var(--sb-card)", fontSize: 11, cursor: u.email ? "pointer" : "not-allowed", opacity: u.email ? 1 : 0.5 }}
                        >
                          {busy === `reset:${u.id}` ? "…" : "Reset link"}
                        </button>
                        <button
                          onClick={() => issueReset(u.id, u.name, true)}
                          disabled={busy === `reset:${u.id}` || !u.email}
                          title={!u.email ? "User has no email" : `Generate reset link and email it to ${u.email}`}
                          style={{ padding: "3px 8px", borderRadius: "0 6px 6px 0", border: "1px solid var(--sb-border)", borderLeft: "none", background: "var(--sb-card)", fontSize: 11, cursor: u.email ? "pointer" : "not-allowed", opacity: u.email ? 1 : 0.5, marginRight: 6 }}
                        >
                          Email
                        </button>
                        <button
                          onClick={() => impersonate(u.id, u.name, true)}
                          disabled={busy === `imp:${u.id}` || !u.isActive}
                          title={!u.isActive ? "User is inactive" : "Sign in as this user (read-only)"}
                          style={{ padding: "3px 8px", borderRadius: "6px 0 0 6px", border: "1px solid #7c3aed", background: "#ede9fe", color: "#6d28d9", fontSize: 11, cursor: u.isActive ? "pointer" : "not-allowed", opacity: u.isActive ? 1 : 0.5 }}
                        >
                          {busy === `imp:${u.id}` ? "…" : "View as"}
                        </button>
                        <button
                          onClick={() => impersonate(u.id, u.name, false)}
                          disabled={busy === `imp:${u.id}` || !u.isActive}
                          title={!u.isActive ? "User is inactive" : "Sign in as this user with full write access"}
                          style={{ padding: "3px 8px", borderRadius: "0 6px 6px 0", border: "1px solid #7c3aed", borderLeft: "none", background: "#7c3aed", color: "white", fontSize: 11, cursor: u.isActive ? "pointer" : "not-allowed", opacity: u.isActive ? 1 : 0.5 }}
                        >
                          R+W
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Recent bills">
        <div style={{ background: "var(--sb-card)", border: "1px solid var(--sb-border)", borderRadius: 12, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--sb-surface-alt)", textAlign: "left" }}>
                <th style={{ padding: "8px 12px", fontSize: 11, color: "var(--sb-muted)" }}>BILL #</th>
                <th style={{ padding: "8px 12px", fontSize: 11, color: "var(--sb-muted)" }}>CUSTOMER</th>
                <th style={{ padding: "8px 12px", fontSize: 11, color: "var(--sb-muted)" }}>TOTAL</th>
                <th style={{ padding: "8px 12px", fontSize: 11, color: "var(--sb-muted)" }}>STATUS</th>
                <th style={{ padding: "8px 12px", fontSize: 11, color: "var(--sb-muted)" }}>WHEN</th>
              </tr>
            </thead>
            <tbody>
              {data.recentBills.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 16, textAlign: "center", color: "var(--sb-muted)" }}>No bills</td></tr>
              ) : data.recentBills.map((b) => (
                <tr key={b.id} style={{ borderTop: "1px solid var(--sb-divider)" }}>
                  <td style={{ padding: "8px 12px", fontFamily: "monospace" }}>{b.billNumber}</td>
                  <td style={{ padding: "8px 12px" }}>{b.customerName}</td>
                  <td style={{ padding: "8px 12px" }}>{fmtMoney(b.grandTotal)}</td>
                  <td style={{ padding: "8px 12px" }}>{b.status}</td>
                  <td style={{ padding: "8px 12px", color: "var(--sb-muted)" }}>{fmtDateTime(b.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Recent payments">
        <div style={{ background: "var(--sb-card)", border: "1px solid var(--sb-border)", borderRadius: 12, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--sb-surface-alt)", textAlign: "left" }}>
                <th style={{ padding: "8px 12px", fontSize: 11, color: "var(--sb-muted)" }}>PARTY</th>
                <th style={{ padding: "8px 12px", fontSize: 11, color: "var(--sb-muted)" }}>AMOUNT</th>
                <th style={{ padding: "8px 12px", fontSize: 11, color: "var(--sb-muted)" }}>DIR</th>
                <th style={{ padding: "8px 12px", fontSize: 11, color: "var(--sb-muted)" }}>MODE</th>
                <th style={{ padding: "8px 12px", fontSize: 11, color: "var(--sb-muted)" }}>WHEN</th>
              </tr>
            </thead>
            <tbody>
              {data.recentPayments.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 16, textAlign: "center", color: "var(--sb-muted)" }}>No payments</td></tr>
              ) : data.recentPayments.map((p) => (
                <tr key={p.id} style={{ borderTop: "1px solid var(--sb-divider)" }}>
                  <td style={{ padding: "8px 12px" }}>{p.partyName ?? "—"}</td>
                  <td style={{ padding: "8px 12px", color: p.direction === "INCOMING" ? "#16a34a" : "#dc2626" }}>
                    {p.direction === "INCOMING" ? "+" : "-"}{fmtMoney(p.amount)}
                  </td>
                  <td style={{ padding: "8px 12px" }}>{p.direction}</td>
                  <td style={{ padding: "8px 12px" }}>{p.mode}</td>
                  <td style={{ padding: "8px 12px", color: "var(--sb-muted)" }}>{fmtDateTime(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {data.unbalancedJournals.length > 0 && (
        <Section title="Unbalanced journal entries">
          <div style={{ background: "var(--sb-card)", border: "1px solid var(--sb-border)", borderRadius: 12, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#fef2f2", textAlign: "left" }}>
                  <th style={{ padding: "8px 12px", fontSize: 11, color: "crimson" }}>DATE</th>
                  <th style={{ padding: "8px 12px", fontSize: 11, color: "crimson" }}>NARRATION</th>
                  <th style={{ padding: "8px 12px", fontSize: 11, color: "crimson" }}>DR</th>
                  <th style={{ padding: "8px 12px", fontSize: 11, color: "crimson" }}>CR</th>
                </tr>
              </thead>
              <tbody>
                {data.unbalancedJournals.map((j) => (
                  <tr key={j.id} style={{ borderTop: "1px solid var(--sb-divider)" }}>
                    <td style={{ padding: "8px 12px" }}>{fmtDate(j.entryDate)}</td>
                    <td style={{ padding: "8px 12px" }}>{j.narration}</td>
                    <td style={{ padding: "8px 12px" }}>{fmtMoney(j.totalDebit)}</td>
                    <td style={{ padding: "8px 12px" }}>{fmtMoney(j.totalCredit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}
