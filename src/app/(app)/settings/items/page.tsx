"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  Input,
  Pagination,
  Select,
  SelectItem,
  Skeleton,
} from "@heroui/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { ITEM_UNITS } from "@/lib/item-catalog";

interface ItemRecord {
  id: string;
  name: string;
  hsnCode: string | null;
  unit: string;
  rate: number;
  taxRate: number | null;
}

interface FormState {
  name: string;
  hsnCode: string;
  unit: string;
  rate: string;
  taxRate: string;
}

const INITIAL_FORM: FormState = {
  name: "",
  hsnCode: "",
  unit: "pcs",
  rate: "",
  taxRate: "",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

async function readError(response: Response) {
  const payload = await response.json().catch(() => null);
  return payload?.error || "Request failed";
}

export default function ItemCatalogPage() {
  const { t } = useLanguage();
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const unitOptions = useMemo(
    () => ITEM_UNITS.map((unit) => ({ key: unit, label: unit })),
    []
  );

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      const response = await fetch(`/api/items?${params}`);
      const payload = await response.json().catch(() => ({ items: [] }));
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load items");
      }
      setItems(payload.items || []);
      setTotalPages(payload.totalPages ?? 1);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to load items",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setPage(1);
  }, [search]);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setEditingId(null);
    setForm(INITIAL_FORM);
  }

  function startEdit(item: ItemRecord) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      hsnCode: item.hsnCode || "",
      unit: item.unit,
      rate: item.rate ? String(item.rate) : "",
      taxRate: item.taxRate != null ? String(item.taxRate) : "",
    });
  }

  async function handleSave() {
    if (!form.name.trim()) {
      showToast(t("items.nameRequired"), "error");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name: form.name,
        hsnCode: form.hsnCode,
        unit: form.unit,
        rate: form.rate,
        taxRate: form.taxRate,
      };

      const response = await fetch(
        editingId ? `/api/items/${editingId}` : "/api/items",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      await fetchItems();
      resetForm();
      showToast(
        editingId ? t("items.updated") : t("items.created"),
        "success"
      );
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to save item",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(itemId: string) {
    if (!confirm(t("items.deleteConfirm"))) {
      return;
    }

    try {
      const response = await fetch(`/api/items/${itemId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      if (editingId === itemId) {
        resetForm();
      }

      await fetchItems();
      showToast(t("items.deleted"), "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to delete item",
        "error"
      );
    }
  }

  return (
    <div className="animate-fade-in p-4 lg:p-8">
      {toast && (
        <div
          className={`fixed right-4 top-4 z-[100] rounded-xl px-4 py-3 shadow-lg animate-slide-up ${
            toast.type === "success" ? "bg-success text-white" : "bg-danger text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t("items.title")}</h1>
        <p className="mt-1 text-sm text-default-500">{t("items.subtitle")}</p>
      </div>

      <Card shadow="sm" className="mb-6">
        <CardBody className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">
                {editingId ? t("items.edit") : t("items.add")}
              </h2>
              <p className="text-sm text-default-500">{t("items.hsnHelp")}</p>
            </div>
            {editingId && (
              <Button variant="light" onPress={resetForm}>
                {t("common.cancel")}
              </Button>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Input
              label={t("items.name")}
              value={form.name}
              onValueChange={(value) => updateForm("name", value)}
              variant="bordered"
            />
            <Input
              label={t("items.hsnCode")}
              value={form.hsnCode}
              onValueChange={(value) => updateForm("hsnCode", value)}
              variant="bordered"
            />
            <Select
              label={t("items.unit")}
              selectedKeys={[form.unit]}
              onSelectionChange={(keys) => {
                const nextValue = Array.from(keys)[0];
                if (typeof nextValue === "string") {
                  updateForm("unit", nextValue);
                }
              }}
              variant="bordered"
            >
              {unitOptions.map((option) => (
                <SelectItem key={option.key} textValue={option.label}>{option.label}</SelectItem>
              ))}

            </Select>
            <Input
              label={t("items.rate")}
              type="number"
              value={form.rate}
              onValueChange={(value) => updateForm("rate", value)}
              variant="bordered"
            />
            <Input
              label={t("items.taxRate")}
              type="number"
              description={t("items.taxRateHelp")}
              value={form.taxRate}
              onValueChange={(value) => updateForm("taxRate", value)}
              variant="bordered"
            />
          </div>

          <div className="flex justify-end">
            <Button
              color="primary"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold"
              isLoading={saving}
              onPress={handleSave}
            >
              {editingId ? t("common.update") : t("items.add")}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card shadow="sm">
        <CardBody className="p-6">
          <div className="mb-4">
            <Input
              aria-label="Search items"
              placeholder="Search items..."
              value={search}
              onValueChange={setSearch}
              variant="bordered"
              startContent={
                <svg className="h-4 w-4 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
                </svg>
              }
            />
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((index) => (
                <Skeleton key={index} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-divider px-6 py-12 text-center">
              <p className="text-lg font-medium text-default-700">{search ? "No items match your search." : t("items.empty")}</p>
              <p className="mt-1 text-sm text-default-400">{t("items.emptyHint")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-4 rounded-2xl border border-divider bg-default-50/80 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="grid flex-1 gap-3 md:grid-cols-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-default-400">
                        {t("items.name")}
                      </p>
                      <p className="font-semibold">{item.name}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-default-400">
                        {t("items.hsnCode")}
                      </p>
                      <p>{item.hsnCode || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-default-400">
                        {t("items.unit")}
                      </p>
                      <p>{item.unit}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-default-400">
                        {t("items.rate")}
                      </p>
                      <p>{formatCurrency(item.rate)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-right text-sm text-default-500">
                      <p>{t("items.taxRate")}</p>
                      <p className="font-medium text-default-700">
                        {item.taxRate != null
                          ? `${item.taxRate}%`
                          : t("items.useBusinessDefault")}
                      </p>
                    </div>
                    <Button size="sm" variant="flat" onPress={() => startEdit(item)}>
                      {t("items.edit")}
                    </Button>
                    <Button
                      size="sm"
                      variant="flat"
                      color="danger"
                      onPress={() => handleDelete(item.id)}
                    >
                      {t("common.delete")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {totalPages > 1 && (
            <div className="mt-4 flex justify-center">
              <Pagination
                total={totalPages}
                page={page}
                onChange={setPage}
                showControls
                size="sm"
              />
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
