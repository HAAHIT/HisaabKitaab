"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Input,
  Select,
  SelectItem,
  Skeleton,
} from "@heroui/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { ITEM_UNITS } from "@/lib/item-catalog";
import {
  GR, AM, OR, SG, IN, TYPE,
  fmtFull,
  HKCard, HKToast, PageHeader, GradientButton, useIsMobile,
} from "@/components/ui/hk-design";

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

const INITIAL_FORM: FormState = { name: "", hsnCode: "", unit: "pcs", rate: "", taxRate: "" };

async function readError(response: Response) {
  const payload = await response.json().catch(() => null);
  return payload?.error || "Request failed";
}

export default function ItemCatalogPage() {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const unitOptions = useMemo(() => ITEM_UNITS.map((unit) => ({ key: unit, label: unit })), []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/items");
      const payload = await response.json().catch(() => ({ items: [] }));
      if (!response.ok) throw new Error(payload?.error || "Failed to load items");
      setItems(payload.items || []);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to load items", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm() { setEditingId(null); setForm(INITIAL_FORM); }

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
    if (!form.name.trim()) { showToast(t("items.nameRequired"), "error"); return; }
    setSaving(true);
    try {
      const payload = { name: form.name, hsnCode: form.hsnCode, unit: form.unit, rate: form.rate, taxRate: form.taxRate };
      const response = await fetch(editingId ? `/api/items/${editingId}` : "/api/items", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await readError(response));
      await fetchItems();
      resetForm();
      showToast(editingId ? t("items.updated") : t("items.created"), "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to save item", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(itemId: string) {
    if (!confirm(t("items.deleteConfirm"))) return;
    try {
      const response = await fetch(`/api/items/${itemId}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await readError(response));
      if (editingId === itemId) resetForm();
      await fetchItems();
      showToast(t("items.deleted"), "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to delete item", "error");
    }
  }

  return (
    <div style={{ background: "var(--hk-bg)", minHeight: "100%", fontFamily: SG }}>
      {toast && <HKToast message={toast.message} type={toast.type} />}

      <PageHeader
        title={t("items.title")}
        subtitle={t("items.subtitle")}
        isMobile={isMobile}
      />

      <div style={{ padding: isMobile ? "0 14px 80px" : "0 28px 80px", maxWidth: 1200, margin: "0 auto" }}>
        {/* Add / Edit form */}
        <HKCard style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--hk-text)", fontFamily: SG, margin: 0 }}>
                {editingId ? t("items.edit") : t("items.add")}
              </p>
              <p style={{ fontSize: TYPE.bodySmall, color: "var(--hk-sub)", fontFamily: SG, marginTop: 4 }}>
                {t("items.hsnHelp")}
              </p>
            </div>
            {editingId && (
              <button
                onClick={resetForm}
                style={{
                  padding: "8px 16px", borderRadius: 10,
                  background: "var(--hk-badge)", border: "1px solid var(--hk-border)",
                  color: "var(--hk-sub)", fontFamily: SG, fontSize: TYPE.bodySmall, fontWeight: 600, cursor: "pointer",
                }}
              >
                {t("common.cancel")}
              </button>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(5, 1fr)", gap: 12, marginBottom: 16 }}>
            <Input label={t("items.name")} value={form.name} onValueChange={(v) => updateForm("name", v)} variant="bordered" />
            <Input label={t("items.hsnCode")} value={form.hsnCode} onValueChange={(v) => updateForm("hsnCode", v)} variant="bordered" />
            <Select
              label={t("items.unit")}
              selectedKeys={[form.unit]}
              onSelectionChange={(keys) => {
                const v = Array.from(keys)[0];
                if (typeof v === "string") updateForm("unit", v);
              }}
              variant="bordered"
            >
              {unitOptions.map((option) => (
                <SelectItem key={option.key} textValue={option.label}>{option.label}</SelectItem>
              ))}
            </Select>
            <Input label={t("items.rate")} type="number" value={form.rate} onValueChange={(v) => updateForm("rate", v)} variant="bordered" />
            <Input label={t("items.taxRate")} type="number" description={t("items.taxRateHelp")} value={form.taxRate} onValueChange={(v) => updateForm("taxRate", v)} variant="bordered" />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <GradientButton onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingId ? t("common.update") : t("items.add")}
            </GradientButton>
          </div>
        </HKCard>

        {/* Items list */}
        <HKCard>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
            </div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", border: "2px dashed var(--hk-border)", borderRadius: 16 }}>
              <p style={{ fontSize: TYPE.bodyLarge, fontWeight: 700, color: "var(--hk-sub)", fontFamily: SG }}>{t("items.empty")}</p>
              <p style={{ fontSize: TYPE.bodySmall, color: "var(--hk-sub)", fontFamily: SG, marginTop: 6 }}>{t("items.emptyHint")}</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex", flexDirection: isMobile ? "column" : "row",
                    alignItems: isMobile ? "flex-start" : "center",
                    justifyContent: "space-between",
                    gap: 12, padding: "16px 20px", borderRadius: 14,
                    background: "var(--hk-bg)", border: "1px solid var(--hk-border)",
                  }}
                >
                  <div style={{ display: "grid", flex: 1, gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12 }}>
                    <div>
                      <p style={{ fontSize: TYPE.caption, fontWeight: 700, color: "var(--hk-sub)", textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: SG, marginBottom: 4 }}>
                        {t("items.name")}
                      </p>
                      <p style={{ fontSize: TYPE.body, fontWeight: 700, color: "var(--hk-text)", fontFamily: SG }}>{item.name}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: TYPE.caption, fontWeight: 700, color: "var(--hk-sub)", textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: SG, marginBottom: 4 }}>
                        {t("items.hsnCode")}
                      </p>
                      <p style={{ fontSize: TYPE.body, color: "var(--hk-text)", fontFamily: SG }}>{item.hsnCode || "—"}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: TYPE.caption, fontWeight: 700, color: "var(--hk-sub)", textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: SG, marginBottom: 4 }}>
                        {t("items.unit")}
                      </p>
                      <p style={{ fontSize: TYPE.body, color: "var(--hk-text)", fontFamily: SG }}>{item.unit}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: TYPE.caption, fontWeight: 700, color: "var(--hk-sub)", textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: SG, marginBottom: 4 }}>
                        {t("items.rate")}
                      </p>
                      <p style={{ fontSize: TYPE.body, fontWeight: 700, color: "var(--hk-text)", fontFamily: IN }}>{fmtFull(item.rate)}</p>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: TYPE.caption, color: "var(--hk-sub)", fontFamily: SG }}>{t("items.taxRate")}</p>
                      <p style={{ fontSize: TYPE.bodySmall, fontWeight: 700, color: "var(--hk-text)", fontFamily: SG }}>
                        {item.taxRate != null ? `${item.taxRate}%` : t("items.useBusinessDefault")}
                      </p>
                    </div>
                    <button
                      onClick={() => startEdit(item)}
                      style={{
                        padding: "8px 14px", borderRadius: 10,
                        background: "var(--hk-badge)", border: "1px solid var(--hk-border)",
                        color: "var(--hk-text)", fontFamily: SG, fontSize: TYPE.bodySmall, fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      {t("items.edit")}
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
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
              ))}
            </div>
          )}
        </HKCard>
      </div>
    </div>
  );
}
