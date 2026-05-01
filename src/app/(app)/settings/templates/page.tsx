"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardBody,
  CardFooter,
  Button,
  Skeleton,
  Chip,
} from "@heroui/react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";

interface Template {
  id: string;
  name: string;
  columns: { name: string; type: string }[];
  createdAt: string;
  _count: { bills: number };
}

export default function TemplatesPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [defaultTemplateId, setDefaultTemplateId] = useState<string | null>(null);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      showToast(
        err instanceof Error ? err.message : "Failed to update default",
        "error"
      );
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
      // If the deleted template was the default, clear it
      if (defaultTemplateId === id) setDefaultTemplateId(null);
      fetchData();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : t("templates.deleteFailed"),
        "error"
      );
    }
  }

  return (
    <div className="p-4 lg:p-8 animate-fade-in">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg animate-slide-up ${
            toast.type === "success"
              ? "bg-success text-white"
              : "bg-danger text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t("templates.title")}</h1>
          <p className="text-default-500 text-sm mt-1">
            {t("templates.subtitle")}
          </p>
        </div>
        <Button
          color="primary"
          className="font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/25"
          onPress={() => router.push("/settings/templates/new")}
          startContent={
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          }
        >
          {t("templates.create")}
        </Button>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <Card shadow="sm">
          <CardBody className="flex flex-col items-center justify-center py-16">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <svg
                className="w-10 h-10 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2zm0 8a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2z"
                />
              </svg>
            </div>
            <p className="text-lg font-medium text-default-600">
              {t("templates.empty")}
            </p>
            <p className="text-sm text-default-400 mt-1">
              {t("templates.emptySubtitle")}
            </p>
            <Button
              color="primary"
              variant="flat"
              size="sm"
              className="mt-4"
              onPress={() => router.push("/settings/templates/new")}
            >
              {t("templates.create")}
            </Button>
          </CardBody>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => {
            const isDefault = template.id === defaultTemplateId;
            return (
              <Card
                key={template.id}
                shadow="sm"
                className={`transition ${isDefault ? "ring-2 ring-primary/40" : "hover:shadow-md"}`}
              >
                <CardBody className="p-5">
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <h3 className="text-lg font-semibold">{template.name}</h3>
                    {isDefault && (
                      <Chip size="sm" color="primary" variant="flat" className="shrink-0">
                        Default
                      </Chip>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {(
                      template.columns as { name: string; type: string }[]
                    ).map((col, i) => (
                      <Chip
                        key={i}
                        size="sm"
                        variant="flat"
                        color={
                          col.type === "formula"
                            ? "warning"
                            : col.type === "number"
                              ? "primary"
                              : "default"
                        }
                      >
                        {col.name}
                      </Chip>
                    ))}
                  </div>
                  <p className="text-xs text-default-400">
                    {template._count.bills} bill(s) •{" "}
                    {new Date(template.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </CardBody>
                <CardFooter className="gap-2 pt-0">
                  {!isDefault && (
                    <Button
                      size="sm"
                      variant="flat"
                      color="primary"
                      isLoading={settingDefault === template.id}
                      onPress={() => handleSetDefault(template.id)}
                    >
                      Set as Default
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() =>
                      router.push(`/settings/templates/${template.id}`)
                    }
                  >
                    {t("templates.edit")}
                  </Button>
                  <Button
                    size="sm"
                    variant="flat"
                    color="danger"
                    onPress={() => handleDelete(template.id)}
                  >
                    {t("common.delete")}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
