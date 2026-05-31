"use client";

import { useState } from "react";
import { HKSelect, HKSelectItem } from "@/components/ui/HKSelect";
import { useRouter } from "next/navigation";
import { validateFormula, translateFormulaToIds, type ColumnDef } from "@/lib/formula";
import { STARTER_TEMPLATES, applyStarter } from "@/lib/default-bill-templates";
import { useLanguage } from "@/contexts/LanguageContext";
import { useConfirm } from "@/contexts/ConfirmContext";
import {
  C, GR, AM, OR, PU, SG, TYPE,
  HKCard, HKToast, PageHeader, useIsMobile,
} from "@/components/ui/hk-design";
import { HKButton } from "@/components/ui/HKButton";
import { HKInput } from "@/components/ui/HKInput";

export default function CreateTemplatePage() {
  const router = useRouter();
  const { t } = useLanguage();
  const confirm = useConfirm();
  const isMobile = useIsMobile();
  const [name, setName] = useState("");
  const [columns, setColumns] = useState<ColumnDef[]>([
    { id: crypto.randomUUID(), name: "", type: "text", position: 0 },
  ]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [starterPicked, setStarterPicked] = useState<string | null>(null);

  function applyStarterTemplate(starterId: string) {
    const starter = STARTER_TEMPLATES.find((s) => s.id === starterId);
    if (!starter) return;
    const filled = applyStarter(starter);
    setName(filled.name);
    setColumns(filled.columns);
    setErrors({});
    setStarterPicked(starterId);
  }

  const columnTypeOptions = [
    { key: "text", label: t("templates.type.text") },
    { key: "number", label: t("templates.type.number") },
    { key: "formula", label: t("templates.type.formula") },
    { key: "date", label: t("templates.type.date") },
    { key: "dropdown", label: t("templates.type.dropdown") },
  ];

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  function addColumn() {
    setColumns([...columns, { id: crypto.randomUUID(), name: "", type: "text", position: columns.length }]);
  }

  async function removeColumn(index: number) {
    const colName = columns[index].name;
    const dependents = columns.filter((c) => c.type === "formula" && c.formula && c.formula.includes(`{${colName}}`));
    if (dependents.length > 0 && colName) {
      const names = dependents.map((d) => d.name).join(", ");
      if (!(await confirm({ message: `This column is used in formulas for: ${names}. Delete anyway?`, confirmLabel: "Delete column", intent: "danger" }))) return;
    }
    const newCols = columns.filter((_, i) => i !== index);
    newCols.forEach((c, i) => (c.position = i));
    setColumns(newCols);
  }

  function updateColumn(index: number, field: keyof ColumnDef, value: string) {
    const newCols = [...columns];
    newCols[index] = { ...newCols[index], [field]: value } as ColumnDef;
    setColumns(newCols);
    const newErrors = { ...errors };
    delete newErrors[index];
    setErrors(newErrors);
  }

  function moveColumn(from: number, to: number) {
    if (to < 0 || to >= columns.length) return;
    const newCols = [...columns];
    const [moved] = newCols.splice(from, 1);
    newCols.splice(to, 0, moved);
    newCols.forEach((c, i) => (c.position = i));
    setColumns(newCols);
  }

  function appendToFormula(index: number, varName: string) {
    const current = columns[index].formula || "";
    const prefix = current && !current.endsWith(" ") ? current + " " : current;
    updateColumn(index, "formula", prefix + `{${varName}}`);
  }

  function validateAll(): boolean {
    const newErrors: Record<number, string> = {};
    let valid = true;
    if (!name.trim()) { showToast(t("templates.nameRequired"), "error"); return false; }
    const colNames = new Set<string>();
    columns.forEach((col, i) => {
      if (!col.name.trim()) { newErrors[i] = t("templates.columnRequired"); valid = false; return; }
      if (colNames.has(col.name)) { newErrors[i] = t("templates.duplicateColumn"); valid = false; return; }
      colNames.add(col.name);
      if (col.type === "formula") {
        if (!col.formula?.trim()) { newErrors[i] = t("templates.formulaRequired"); valid = false; return; }
        const result = validateFormula(col.formula, col.name, columns);
        if (!result.valid) { newErrors[i] = result.error || t("templates.invalidFormula"); valid = false; }
      }
    });
    setErrors(newErrors);
    return valid;
  }

  async function handleSave() {
    if (!validateAll()) return;
    const encodedColumns = columns.map((col) => {
      if (col.type === "formula" && col.formula) return { ...col, formula: translateFormulaToIds(col.formula, columns) };
      return col;
    });
    setSaving(true);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, columns: encodedColumns }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(t("templates.createdSuccess"), "success");
      setTimeout(() => router.push("/settings/templates"), 500);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  }

  const iconBtnStyle = (color: string, disabled?: boolean): React.CSSProperties => ({
    width: 32, height: 32, borderRadius: 8,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: color + "12", border: `1px solid ${color}33`, color,
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.35 : 1,
  });

  return (
    <>
      {toast && <HKToast message={toast.message} type={toast.type} />}

      <div style={{ fontFamily: SG }}>
        <PageHeader
          title={t("templates.createTitle")}
          subtitle={t("templates.createSubtitle")}
          isMobile={isMobile}
          action={
            <button
              onClick={() => router.push("/settings/templates")}
              style={{
                minHeight: 44, padding: "0 18px", borderRadius: 12,
                background: "var(--sb-badge)", border: "1px solid var(--sb-border)",
                color: "var(--sb-text)", fontFamily: SG, fontSize: TYPE.body, fontWeight: 600, cursor: "pointer",
              }}
            >
              ← Back
            </button>
          }
        />
        <div>
          {/* Starter picker */}
          <HKCard style={{ marginBottom: 20 }}>
            <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--sb-text)", fontFamily: SG, margin: "0 0 4px" }}>
              Start from a template
            </p>
            <p style={{ fontSize: TYPE.bodySmall, color: "var(--sb-sub)", fontFamily: SG, margin: "0 0 16px" }}>
              Pick a starting point and edit before saving, or skip to design your own from scratch.
            </p>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              {STARTER_TEMPLATES.map((s) => {
                const active = starterPicked === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => applyStarterTemplate(s.id)}
                    style={{
                      textAlign: "left",
                      padding: "14px 16px",
                      borderRadius: 12,
                      background: active ? "var(--sb-primary)" : "var(--sb-bg)",
                      color: active ? "#fff" : "var(--sb-text)",
                      border: `1.5px solid ${active ? "var(--sb-primary)" : "var(--sb-border)"}`,
                      cursor: "pointer",
                      fontFamily: SG,
                      transition: "all 0.15s",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <span style={{ fontSize: TYPE.body, fontWeight: 700 }}>{s.name}</span>
                    <span style={{ fontSize: 11, opacity: 0.85, lineHeight: 1.4 }}>{s.description}</span>
                    <span style={{
                      marginTop: 4,
                      fontSize: 10,
                      fontFamily: "ui-monospace, monospace",
                      letterSpacing: 0.5,
                      opacity: 0.75,
                    }}>
                      Prefix: {s.suggestedPrefix}
                    </span>
                  </button>
                );
              })}
            </div>
          </HKCard>

          {/* Template name */}
          <HKCard style={{ marginBottom: 20 }}>
            <HKInput
              label={t("templates.templateName")}
              placeholder={t("templates.templateNamePlaceholder")}
              value={name}
              onValueChange={setName}
              size="lg"
              isRequired
            />
          </HKCard>

          {/* Columns */}
          <HKCard style={{ marginBottom: 20 }}>
            <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--sb-text)", fontFamily: SG, margin: "0 0 20px" }}>
              {t("templates.columns")}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {columns.map((col, index) => (
                <div
                  key={index}
                  style={{
                    background: "var(--sb-bg)", border: "1px solid var(--sb-border)", borderRadius: 16,
                    padding: "16px", display: "flex", flexDirection: "column", gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    {/* Up/down controls */}
                    <div style={{
                      display: "flex", flexDirection: "column", gap: 2, alignItems: "center",
                      background: "var(--sb-badge)", borderRadius: 8, padding: "4px",
                    }}>
                      <button
                        onClick={() => moveColumn(index, index - 1)}
                        disabled={index === 0}
                        style={iconBtnStyle("var(--sb-sub)" as string, index === 0)}
                        aria-label="Move up"
                      >
                        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => moveColumn(index, index + 1)}
                        disabled={index === columns.length - 1}
                        style={iconBtnStyle("var(--sb-sub)" as string, index === columns.length - 1)}
                        aria-label="Move down"
                      >
                        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    {/* Position badge */}
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                      background: C.primary + "18", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: TYPE.bodySmall, fontWeight: 700, color: C.primary, fontFamily: SG,
                    }}>
                      {index + 1}
                    </div>

                    {/* Name + Type inputs */}
                    <div style={{ flex: 1, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                      <HKInput
                        label={t("templates.columnName")}
                        placeholder={t("templates.columnNamePlaceholder")}
                        value={col.name}
                        onValueChange={(v) => updateColumn(index, "name", v)}
                        size="sm"
                        isRequired
                      />
                      <HKSelect
                        label={t("templates.type")}
                        placeholder={t("templates.type")}
                        value={col.type}
                        onValueChange={(val) => { if (val) updateColumn(index, "type", val); }}
                        size="sm"
                      >
                        {columnTypeOptions.map((option) => (
                          <HKSelectItem key={option.key} value={option.key}>{option.label}</HKSelectItem>
                        ))}
                      </HKSelect>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={() => removeColumn(index)}
                      disabled={columns.length === 1}
                      aria-label={`Remove column ${index + 1}`}
                      style={iconBtnStyle(OR, columns.length === 1)}
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  {/* Formula builder */}
                  {col.type === "formula" && (
                    <div style={{
                      marginLeft: isMobile ? 0 : 80, padding: 14, borderRadius: 12,
                      background: AM + "10", border: `1px solid ${AM}33`,
                    }}>
                      <p style={{ fontSize: TYPE.bodySmall, fontWeight: 700, color: AM, fontFamily: SG, margin: "0 0 10px", display: "flex", alignItems: "center", gap: 6 }}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        {t("templates.buildFormula")}
                      </p>
                      <HKInput
                        aria-label={t("templates.buildFormula")}
                        placeholder={t("templates.formulaPlaceholder")}
                        value={col.formula || ""}
                        onValueChange={(v) => updateColumn(index, "formula", v)}
                        isInvalid={!!errors[index]}
                        errorMessage={errors[index] || t("templates.formulaHelp")}
                      />
                      <div style={{ marginTop: 12 }}>
                        <p style={{ fontSize: TYPE.caption, color: "var(--sb-sub)", fontFamily: SG, marginBottom: 8, fontWeight: 600 }}>
                          {t("templates.insertColumns")}
                        </p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {columns.slice(0, index).filter((c) => c.name.trim()).length > 0 ? (
                            columns.slice(0, index).filter((c) => c.name.trim()).map((prevCol, i) => (
                              <span
                                key={i}
                                onClick={() => appendToFormula(index, prevCol.name)}
                                style={{
                                  fontSize: TYPE.caption, fontWeight: 700, color: AM,
                                  background: AM + "18", padding: "3px 8px", borderRadius: 6,
                                  fontFamily: SG, cursor: "pointer",
                                }}
                              >
                                {prevCol.name}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: TYPE.caption, color: "var(--sb-sub)", fontFamily: SG, fontStyle: "italic" }}>
                              {t("templates.noPreviousColumns")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Dropdown options */}
                  {col.type === "dropdown" && (
                    <div style={{
                      marginLeft: isMobile ? 0 : 80, padding: 14, borderRadius: 12,
                      background: PU + "10", border: `1px solid ${PU}33`,
                    }}>
                      <p style={{ fontSize: TYPE.bodySmall, fontWeight: 700, color: PU, fontFamily: SG, margin: "0 0 10px", display: "flex", alignItems: "center", gap: 6 }}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
                        {t("templates.dropdownOptions")}
                      </p>
                      <HKInput
                        aria-label={t("templates.dropdownOptions")}
                        placeholder={t("templates.dropdownPlaceholder")}
                        value={(col.options || []).join(",")}
                        onValueChange={(v) => {
                          const newCols = [...columns];
                          newCols[index].options = v.split(",");
                          setColumns(newCols);
                        }}
                        description={t("templates.dropdownDescription")}
                      />
                    </div>
                  )}

                  {errors[index] && col.type !== "formula" && (
                    <p style={{ fontSize: TYPE.bodySmall, color: OR, fontFamily: SG, margin: "0 0 0 80px", fontWeight: 600 }}>
                      {errors[index]}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={addColumn}
              style={{
                marginTop: 16, width: "100%", minHeight: 44, borderRadius: 12,
                background: GR + "10", border: `1.5px dashed ${GR}44`,
                color: GR, fontFamily: SG, fontSize: TYPE.body, fontWeight: 700, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t("templates.addColumn")}
            </button>
          </HKCard>

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <HKButton variant="secondary" onClick={() => router.push("/settings/templates")}>
              {t("common.cancel")}
            </HKButton>
            <HKButton onClick={handleSave} isLoading={saving}>
              {t("templates.saveTemplate")}
            </HKButton>
          </div>
        </div>
      </div>
    </>
  );
}
