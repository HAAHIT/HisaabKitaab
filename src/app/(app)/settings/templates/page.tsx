"use client";

import { useState, useEffect, useCallback } from "react";
import { HKSkeleton } from "@/components/ui/HKSkeleton";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  GR, AM, OR, PU, SG, TYPE,
  HKCard, HKToast, PageHeader, useIsMobile,
} from "@/components/ui/hk-design";
import { HKButton } from "@/components/ui/HKButton";

interface Template {
  id: string;
  name: string;
  columns: { name: string; type: string }[];
  createdAt: string;
  _count: { bills: number };
}

const COL_TYPE_COLOR: Record<string, string> = {
  formula: AM,
  number: PU,
  dropdown: GR,
  date: OR,
  text: "var(--sb-sub)",
};

export default function TemplatesPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [defaultTemplateId, setDefaultTemplateId] = useState<string | null>(null);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [templatesRes, settingsRes] = await Promise.all([
        fetch("/api/templates"),
        fetch("/api/settings"),
      ]);
      const [templatesData, settingsData] = await Promise.all([
        templatesRes.json(),
        settingsRes.json(),
      ]);
      setTemplates(templatesData.templates || []);
      setDefaultTemplateId(settingsData.settings?.defaultTemplateId || null);
    } catch {
      showToast(t("templates.fetchFailed"), "error");
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSetDefault(id: string) {
    setSettingDefault(id);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultTemplateId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDefaultTemplateId(id);
      showToast("Default template updated", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update default", "error");
    } finally {
      setSettingDefault(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t("templates.deleteConfirm"))) return;
    try {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(t("templates.deleted"), "success");
      if (defaultTemplateId === id) setDefaultTemplateId(null);
      fetchData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("templates.deleteFailed"), "error");
    }
  }

  return (
    <div style={{ fontFamily: SG }}>
      {toast && <HKToast message={toast.message} type={toast.type} />}
      <PageHeader
        title={t("templates.title")}
        subtitle={t("templates.subtitle")}
        isMobile={isMobile}
        action={
          <HKButton onClick={() => router.push("/settings/templates/new")}>
            + {t("templates.create")}
          </HKButton>
        }
      />
      <div>
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 16 }}>
            {[1, 2, 3].map((i) => <HKSkeleton key={i} className="h-44 rounded-2xl" />)}
          </div>
        ) : templates.length === 0 ? (
          <HKCard style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>📋</div>
            <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--sb-text)", fontFamily: SG, marginBottom: 8 }}>
              {t("templates.empty")}
            </p>
            <p style={{ fontSize: TYPE.body, color: "var(--sb-sub)", fontFamily: SG, marginBottom: 20 }}>
              {t("templates.emptySubtitle")}
            </p>
            <HKButton onClick={() => router.push("/settings/templates/new")}>
              {t("templates.create")}
            </HKButton>
          </HKCard>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 16 }}>
            {templates.map((template) => {
              const isDefault = template.id === defaultTemplateId;
              return (
                <div
                  key={template.id}
                  style={{
                    background: "var(--sb-card)",
                    borderRadius: 20,
                    border: `1.5px solid ${isDefault ? PU + "60" : "var(--sb-border)"}`,
                    padding: "20px 20px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    boxShadow: isDefault ? `0 0 0 3px ${PU}15` : "none",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <p style={{ fontSize: TYPE.bodyLarge, fontWeight: 700, color: "var(--sb-text)", fontFamily: SG, margin: 0 }}>
                      {template.name}
                    </p>
                    {isDefault && (
                      <span
                        style={{
                          fontSize: TYPE.chip, fontWeight: 700, color: PU,
                          background: PU + "18", padding: "3px 10px", borderRadius: 8,
                          flexShrink: 0, fontFamily: SG,
                        }}
                      >
                        Default
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {template.columns.map((col, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: TYPE.caption, fontWeight: 700,
                          color: COL_TYPE_COLOR[col.type] || "var(--sb-sub)",
                          background: (COL_TYPE_COLOR[col.type] || "var(--sb-sub)") + "18",
                          padding: "3px 8px", borderRadius: 6, fontFamily: SG,
                        }}
                      >
                        {col.name}
                      </span>
                    ))}
                  </div>

                  <p style={{ fontSize: TYPE.caption, color: "var(--sb-sub)", fontFamily: SG, margin: 0 }}>
                    {template._count.bills} bill(s) · {new Date(template.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {!isDefault && (
                      <button
                        onClick={() => handleSetDefault(template.id)}
                        disabled={settingDefault === template.id}
                        style={{
                          padding: "8px 14px", borderRadius: 10,
                          background: PU + "12", border: `1px solid ${PU}33`,
                          color: PU, fontFamily: SG, fontSize: TYPE.bodySmall, fontWeight: 600,
                          cursor: settingDefault === template.id ? "not-allowed" : "pointer",
                          opacity: settingDefault === template.id ? 0.6 : 1,
                        }}
                      >
                        {settingDefault === template.id ? "Setting..." : "Set as Default"}
                      </button>
                    )}
                    <button
                      onClick={() => router.push(`/settings/templates/${template.id}`)}
                      style={{
                        padding: "8px 14px", borderRadius: 10,
                        background: "var(--sb-badge)", border: "1px solid var(--sb-border)",
                        color: "var(--sb-text)", fontFamily: SG, fontSize: TYPE.bodySmall, fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      {t("templates.edit")}
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      style={{
                        padding: "8px 14px", borderRadius: 10,
                        background: OR + "12", border: `1px solid ${OR}33`,
                        color: OR, fontFamily: SG, fontSize: TYPE.bodySmall, fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      {t("common.delete")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
