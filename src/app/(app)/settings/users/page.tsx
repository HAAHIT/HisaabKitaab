"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Select,
  SelectItem,
  Skeleton,
} from "@heroui/react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  GR, AM, OR, PU, SG, IN, TYPE,
  HKCard, HKToast, PageHeader, useIsMobile,
} from "@/components/ui/hk-design";
import { HKButton } from "@/components/ui/HKButton";
import { HKInput } from "@/components/ui/HKInput";

interface User {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
}

const ROLE_COLOR: Record<string, string> = { ADMIN: PU, STAFF: GR, ACCOUNTANT: AM, CUSTOMER: OR };

export default function UserManagementPage() {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPanel, setShowPanel] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState("STAFF");
  const [showPassword, setShowPassword] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      setUsers(data.users || []);
    } catch {
      showToast(t("users.fetchFailed"), "error");
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  function generatePassword() {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
    let pw = "";
    for (let i = 0; i < 16; i++) pw += chars.charAt(Math.floor(Math.random() * chars.length));
    setFormPassword(pw);
  }

  function openCreatePanel() {
    setEditingUser(null);
    setFormName(""); setFormEmail(""); setFormPhone(""); setFormPassword(""); setFormRole("STAFF"); setShowPassword(false);
    setShowPanel(true);
  }

  function openEditPanel(user: User) {
    setEditingUser(user);
    setFormName(user.name); setFormEmail(user.email || ""); setFormPhone(user.phone || ""); setFormPassword(""); setFormRole(user.role); setShowPassword(false);
    setShowPanel(true);
  }

  async function handleSave() {
    if (!formName || !formPhone) { showToast(t("users.nameRequiredPhone"), "error"); return; }
    if (!editingUser && (!formPassword || formPassword.length < 12)) { showToast(t("users.passwordMin"), "error"); return; }

    setSaving(true);
    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
      const method = editingUser ? "PATCH" : "POST";
      const bodyData: Record<string, unknown> = { name: formName, email: formEmail || undefined, phone: formPhone, userRole: formRole };
      if (formPassword) bodyData.password = formPassword;

      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodyData) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save user");

      showToast(editingUser ? t("users.updated") : t("users.createdSuccess"), "success");
      setShowPanel(false);
      fetchUsers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("users.saveFailed"), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(userId: string) {
    if (!confirm(t("users.deactivateConfirm"))) return;
    try {
      const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete user");
      showToast(t("users.deactivated"), "success");
      fetchUsers();
    } catch {
      showToast(t("users.deactivateFailed"), "error");
    }
  }

  return (
    <>
      <div style={{ background: "var(--hk-bg)", minHeight: "100%", fontFamily: SG }}>
        {toast && <HKToast message={toast.message} type={toast.type} />}

        <PageHeader
          title={t("users.title")}
          subtitle={t("users.subtitle")}
          isMobile={isMobile}
          action={
            <HKButton onClick={openCreatePanel}>
              + {t("users.add")}
            </HKButton>
          }
        />

        <div style={{ padding: isMobile ? "0 14px 80px" : "0 28px 80px", maxWidth: 1200, margin: "0 auto" }}>
          <HKCard style={{ padding: 0, overflow: "hidden" }}>
            {loading ? (
              <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
              </div>
            ) : users.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <p style={{ fontSize: TYPE.body, color: "var(--hk-sub)", fontFamily: SG, marginBottom: 16 }}>No users found</p>
                <HKButton onClick={openCreatePanel}>{t("users.createFirst")}</HKButton>
              </div>
            ) : (
              <div>
                {/* Table header */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr auto" : "2fr 2fr 1fr 1fr 1fr auto",
                    gap: 12, padding: "12px 20px",
                    borderBottom: "1px solid var(--hk-border)",
                    background: "var(--hk-badge)",
                  }}
                >
                  {[t("users.name"), ...(isMobile ? [] : [t("users.contact"), t("users.role"), t("users.status"), t("users.created")]), t("users.actions")].map((h) => (
                    <p key={h} style={{ fontSize: TYPE.caption, fontWeight: 700, color: "var(--hk-sub)", textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: SG, margin: 0 }}>
                      {h}
                    </p>
                  ))}
                </div>

                {users.map((user) => {
                  const roleColor = ROLE_COLOR[user.role] || PU;
                  return (
                    <div
                      key={user.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: isMobile ? "1fr auto" : "2fr 2fr 1fr 1fr 1fr auto",
                        gap: 12, padding: "14px 20px", alignItems: "center",
                        borderBottom: "1px solid var(--hk-border)",
                      }}
                    >
                      <p style={{ fontSize: TYPE.body, fontWeight: 700, color: "var(--hk-text)", fontFamily: SG, margin: 0 }}>
                        {user.name}
                      </p>
                      {!isMobile && (
                        <div>
                          {user.email && <p style={{ fontSize: TYPE.bodySmall, color: "var(--hk-text)", fontFamily: SG, margin: 0 }}>{user.email}</p>}
                          {user.phone && <p style={{ fontSize: TYPE.bodySmall, color: "var(--hk-sub)", fontFamily: SG, margin: 0 }}>{user.phone}</p>}
                        </div>
                      )}
                      {!isMobile && (
                        <span style={{ fontSize: TYPE.chip, fontWeight: 700, color: roleColor, background: roleColor + "18", padding: "4px 10px", borderRadius: 8, fontFamily: SG }}>
                          {user.role.toLowerCase()}
                        </span>
                      )}
                      {!isMobile && (
                        <span style={{
                          fontSize: TYPE.chip, fontWeight: 700,
                          color: user.isActive ? GR : "var(--hk-sub)",
                          background: user.isActive ? GR + "18" : "var(--hk-badge)",
                          padding: "4px 10px", borderRadius: 8, fontFamily: SG,
                        }}>
                          {user.isActive ? t("users.active") : t("users.inactive")}
                        </span>
                      )}
                      {!isMobile && (
                        <p style={{ fontSize: TYPE.bodySmall, color: "var(--hk-sub)", fontFamily: IN, margin: 0 }}>
                          {new Date(user.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      )}
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => openEditPanel(user)}
                          aria-label={`Edit ${user.name}`}
                          style={{
                            width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                            background: "var(--hk-badge)", border: "1px solid var(--hk-border)", cursor: "pointer",
                            color: "var(--hk-text)",
                          }}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          aria-label={`Delete ${user.name}`}
                          style={{
                            width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                            background: OR + "12", border: `1px solid ${OR}33`, cursor: "pointer",
                            color: OR,
                          }}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </HKCard>
        </div>
      </div>

      {/* Slide-over panel */}
      {showPanel && (
        <>
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 50 }}
            onClick={() => setShowPanel(false)}
          />
          <div
            style={{
              position: "fixed", right: 0, top: 0, bottom: 0, width: "100%", maxWidth: 440,
              background: "var(--hk-card)", boxShadow: "0 0 60px rgba(0,0,0,0.25)",
              zIndex: 51, overflowY: "auto", animation: "slide-in-right 0.28s ease-out",
              fontFamily: SG,
            }}
          >
            <div style={{ padding: "24px 24px 40px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <p style={{ fontSize: TYPE.h2, fontWeight: 800, color: "var(--hk-text)", fontFamily: SG, margin: 0 }}>
                  {editingUser ? t("users.edit") : t("users.createTitle")}
                </p>
                <button
                  onClick={() => setShowPanel(false)}
                  style={{
                    width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                    background: "var(--hk-badge)", border: "1px solid var(--hk-border)", cursor: "pointer", color: "var(--hk-text)",
                  }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <HKInput label={t("users.name")} placeholder="Enter full name" value={formName} onValueChange={setFormName} isRequired />
                <HKInput label={t("users.email")} placeholder="Enter email (optional)" type="email" value={formEmail} onValueChange={setFormEmail} />
                <HKInput label={t("users.phone")} placeholder="Enter phone number" type="tel" value={formPhone} onValueChange={setFormPhone} isRequired />
                <HKInput
                  label={t("users.password")}
                  placeholder={editingUser ? t("users.leaveBlank") : t("users.minChars")}
                  type={showPassword ? "text" : "password"}
                  value={formPassword}
                  onValueChange={setFormPassword}
                  isRequired={!editingUser}
                  endContent={
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        style={{ padding: "4px 8px", borderRadius: 8, background: "var(--hk-badge)", border: "none", cursor: "pointer", fontSize: TYPE.caption, color: "var(--hk-sub)", fontFamily: SG }}
                      >
                        {showPassword ? t("common.hide") : t("common.show")}
                      </button>
                      <button
                        type="button"
                        onClick={generatePassword}
                        style={{ padding: "4px 8px", borderRadius: 8, background: "var(--hk-badge)", border: "none", cursor: "pointer", fontSize: TYPE.caption, color: "var(--hk-sub)", fontFamily: SG }}
                      >
                        {t("common.generate")}
                      </button>
                    </div>
                  }
                />
                <Select
                  label={t("users.role")}
                  placeholder={t("users.role")}
                  selectedKeys={new Set([formRole])}
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys)[0] as string;
                    if (selected) setFormRole(selected);
                  }}
                  variant="bordered"
                >
                  <SelectItem key="STAFF" textValue={t("users.staff")}>{t("users.staff")}</SelectItem>
                  <SelectItem key="ACCOUNTANT" textValue={t("users.accountant")}>{t("users.accountant")}</SelectItem>
                  <SelectItem key="CUSTOMER" textValue={t("users.customer")}>{t("users.customer")}</SelectItem>
                </Select>

                <div style={{ display: "flex", gap: 12, paddingTop: 8 }}>
                  <HKButton variant="secondary" onClick={() => setShowPanel(false)} isDisabled={saving} style={{ flex: 1 }}>{t("common.cancel")}</HKButton>
                  <HKButton onClick={handleSave} isLoading={saving} style={{ flex: 1 }}>{editingUser ? t("common.update") : t("users.createUser")}</HKButton>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
