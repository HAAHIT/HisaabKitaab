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

interface Template {
  id: string;
  name: string;
  columns: { name: string; type: string }[];
  createdAt: string;
  _count: { bills: number };
}

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/templates");
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch {
      showToast("Failed to fetch templates", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this template?")) return;
    try {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast("Template deleted", "success");
      fetchTemplates();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to delete",
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
          <h1 className="text-2xl font-bold">Bill Templates</h1>
          <p className="text-default-500 text-sm mt-1">
            Define column structures for your invoices
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
          Create Template
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
              No templates yet
            </p>
            <p className="text-sm text-default-400 mt-1">
              Create your first bill template to start invoicing
            </p>
            <Button
              color="primary"
              variant="flat"
              size="sm"
              className="mt-4"
              onPress={() => router.push("/settings/templates/new")}
            >
              Create Template
            </Button>
          </CardBody>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <Card key={t.id} shadow="sm" className="hover:shadow-md transition">
              <CardBody className="p-5">
                <h3 className="text-lg font-semibold mb-2">{t.name}</h3>
                <div className="flex flex-wrap gap-1 mb-3">
                  {(
                    t.columns as { name: string; type: string }[]
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
                  {t._count.bills} bill(s) •{" "}
                  {new Date(t.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </CardBody>
              <CardFooter className="gap-2 pt-0">
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() =>
                    router.push(`/settings/templates/${t.id}`)
                  }
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  color="danger"
                  onPress={() => handleDelete(t.id)}
                >
                  Delete
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
