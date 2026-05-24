"use client";

import { useEffect, useState } from "react";

interface SuperAdmin {
  id: string;
  name: string;
  email: string | null;
  isActive: boolean;
  createdAt: string;
  isSelf: boolean;
}

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const PASSWORD_INPUT_STYLE: React.CSSProperties = {
  background: "var(--sb-card)",
  border: "1px solid var(--sb-border)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  color: "var(--sb-text)",
  width: "100%",
};

function ChangeOwnPassword() {
  const inputStyle = PASSWORD_INPUT_STYLE;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (next !== confirm) {
      setError("New password and confirmation don't match");
      return;
    }
    if (next.length < 10) {
      setError("New password must be at least 10 characters");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      setCurrent(""); setNext(""); setConfirm("");
      setSuccess(true);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      style={{
        background: "var(--sb-card)",
        border: "1px solid var(--sb-border)",
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        maxWidth: 560,
      }}
    >
      <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Change your password</h2>
      <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
        <input
          required
          type="password"
          autoComplete="current-password"
          placeholder="Current password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          style={inputStyle}
        />
        <input
          required
          type="password"
          autoComplete="new-password"
          placeholder="New password (min 10 chars)"
          minLength={10}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          style={inputStyle}
        />
        <input
          required
          type="password"
          autoComplete="new-password"
          placeholder="Confirm new password"
          minLength={10}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          style={inputStyle}
        />
        {error && <div style={{ color: "crimson", fontSize: 12 }}>{error}</div>}
        {success && <div style={{ color: "#166534", fontSize: 12 }}>Password updated.</div>}
        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: "none",
            background: "var(--sb-primary)",
            color: "white",
            fontSize: 13,
            fontWeight: 600,
            cursor: submitting ? "wait" : "pointer",
            justifySelf: "start",
          }}
        >
          {submitting ? "Saving…" : "Update password"}
        </button>
      </form>
    </section>
  );
}

export default function SuperAdminsPage() {
  const [rows, setRows] = useState<SuperAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/admin/superadmins")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => setRows(j.data))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/superadmins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      setForm({ name: "", email: "", password: "" });
      load();
    } catch (err) {
      setFormError(String(err instanceof Error ? err.message : err));
    } finally {
      setSubmitting(false);
    }
  };

  const revoke = async (id: string, name: string) => {
    if (!confirm(`Revoke superadmin access for ${name}?`)) return;
    try {
      const res = await fetch(`/api/admin/superadmins/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      load();
    } catch (err) {
      alert(String(err instanceof Error ? err.message : err));
    }
  };

  const inputStyle: React.CSSProperties = {
    background: "var(--sb-card)",
    border: "1px solid var(--sb-border)",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 13,
    color: "var(--sb-text)",
    width: "100%",
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Superadmins</h1>
      <p style={{ color: "var(--sb-muted)", marginBottom: 20, fontSize: 13 }}>
        Manage platform-level admins. They have cross-tenant access.
      </p>

      <ChangeOwnPassword />

      <section
        style={{
          background: "var(--sb-card)",
          border: "1px solid var(--sb-border)",
          borderRadius: 12,
          padding: 16,
          marginBottom: 24,
          maxWidth: 560,
        }}
      >
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Add new superadmin</h2>
        <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
          <input
            required
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            style={inputStyle}
          />
          <input
            required
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            style={inputStyle}
          />
          <input
            required
            type="password"
            placeholder="Password (min 10 chars)"
            minLength={10}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            style={inputStyle}
          />
          {formError && <div style={{ color: "crimson", fontSize: 12 }}>{formError}</div>}
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "none",
              background: "var(--sb-primary)",
              color: "white",
              fontSize: 13,
              fontWeight: 600,
              cursor: submitting ? "wait" : "pointer",
              justifySelf: "start",
            }}
          >
            {submitting ? "Creating…" : "Create superadmin"}
          </button>
        </form>
      </section>

      <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: "var(--sb-muted)" }}>Existing</h2>
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
              {["Name", "Email", "Status", "Created", ""].map((h) => (
                <th key={h} style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--sb-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "var(--sb-muted)" }}>Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "var(--sb-muted)" }}>None</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--sb-divider)" }}>
                <td style={{ padding: "10px 12px", fontWeight: 600 }}>
                  {r.name}
                  {r.isSelf && <span style={{ marginLeft: 8, fontSize: 11, color: "var(--sb-muted)" }}>(you)</span>}
                </td>
                <td style={{ padding: "10px 12px", color: "var(--sb-muted)" }}>{r.email ?? "—"}</td>
                <td style={{ padding: "10px 12px" }}>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 600,
                      background: r.isActive ? "#dcfce7" : "var(--sb-surface-alt)",
                      color: r.isActive ? "#166534" : "var(--sb-muted)",
                    }}
                  >
                    {r.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td style={{ padding: "10px 12px", color: "var(--sb-muted)" }}>{fmtDate(r.createdAt)}</td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>
                  {!r.isSelf && (
                    <button
                      onClick={() => revoke(r.id, r.name)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: "1px solid var(--sb-border)",
                        background: "var(--sb-card)",
                        color: "crimson",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
