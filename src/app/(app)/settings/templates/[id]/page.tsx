"use client";

import { useState, useEffect, use } from "react";
import { HKSelect, HKSelectItem } from "@/components/ui/HKSelect";
import { HKSkeleton } from "@/components/ui/HKSkeleton";
import { useRouter } from "next/navigation";
import { validateFormula, translateFormulaToNames, translateFormulaToIds, type ColumnDef } from "@/lib/formula";
import {
  GR, AM, OR, PU, SG, TYPE,
  HKCard, HKToast, PageHeader, useIsMobile,
} from "@/components/ui/hk-design";
import { HKButton } from "@/components/ui/HKButton";
import { HKInput } from "@/components/ui/HKInput";

const COLUMN_TYPES = [
  { key: "text", label: "Text" },
  { key: "number", label: "Number" },
  { key: "formula", label: "Formula" },
  { key: "date", label: "Date" },
  { key: "dropdown", label: "Dropdown" },
];

export default function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [columns, setColumns] = useState<ColumnDef[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetch(`/api/templates/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Template not found");
        return res.json();
      })
      .then((data) => {
        const decodedColumns = data.template.columns.map((col: ColumnDef) => {
          if (col.type === "formula" && col.formula) {
            return { ...col, formula: translateFormulaToNames(col.formula, data.template.columns) };
          }
          return col;
        });
        setName(data.template.name);
        setColumns(decodedColumns);
      })
      .catch((err) => {
        showToast(err.message, "error");
        setTimeout(() => router.push("/settings/templates"), 1500);
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  function addColumn() {
    setColumns([...columns, { id: crypto.randomUUID(), name: "", type: "text", position: columns.length }]);
  }

  function removeColumn(index: number) {
    const colName = columns[index].name;
    const dependents = columns.filter((c) => c.type === "formula" && c.formula && c.formula.includes(`{${colName}}`));
    if (dependents.length > 0 && colName) {
      const names = dependents.map((d) => d.name).join(", ");
      if (!confirm(`This column is used in formulas for: ${names}. Delete anyway?`)) return;
    }
    const newCols = columns.filter((_, i) => i !== index);
    newCols.forEach((c, i) => (c.position = i));
    setColumns(newCols);
  }

  function updateColumn(index: number, field: keyof ColumnDef, value: string) {
    const newCols = [...columns];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newCols[index] as any)[field] = value;
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
    if (!name.trim()) { showToast("Template name is required", "error"); return false; }
    const colNames = new Set<string>();
    columns.forEach((col, i) => {
      if (!col.name.trim()) { newErrors[i] = "Column name is required"; valid = false; return; }
      if (colNames.has(col.name)) { newErrors[i] = "Duplicate column name"; valid = false; return; }
      colNames.add(col.name);
      if (col.type === "formula") {
        if (!col.formula?.trim()) { newErrors[i] = "Formula is required"; valid = false; return; }
        const result = validateFormula(col.formula, col.name, columns);
        if (!result.valid) { newErrors[i] = result.error || "Invalid formula"; valid = false; }
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
      const res = await fetch(`/api/templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, columns: encodedColumns }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast("Template updated!", "success");
      setTimeout(() => router.push("/settings/templates"), 500);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update", "error");
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

  if (loading) {
    return (
      <div style={{ padding: isMobile ? "20px 14px" : "20px 28px", maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <HKSkeleton className="h-10 w-48 rounded-2xl" />
          <HKSkeleton className="h-20 w-full rounded-2xl" />
          <HKSkeleton className="h-60 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <>
      {toast && <HKToast message={toast.message} type={toast.type} />}

      <div style={{ background: "var(--hk-bg)", minHeight: "100%", fontFamily: SG }}>
        <PageHeader
          title="Edit Template"
          subtitle="Update columns and formulas"
          isMobile={isMobile}
          action={
            <button
              onClick={() => router.push("/settings/templates")}
              style={{
                minHeight: 44, padding: "0 18px", borderRadius: 12,
                background: "var(--hk-badge)", border: "1px solid var(--hk-border)",
                color: "var(--hk-text)", fontFamily: SG, fontSize: TYPE.body, fontWeight: 600, cursor: "pointer",
              }}
            >
              ← Back
            </button>
          }
        />

        <div style={{ padding: isMobile ? "0 14px 80px" : "0 28px 80px", maxWidth: 900, margin: "0 auto" }}>
          {/* Template name */}
          <HKCard style={{ marginBottom: 20 }}>
            <HKInput
              label="Template Name"
              placeholder="e.g. Order Invoice"
              value={name}
              onValueChange={setName}
              size="lg"
              isRequired
            />
          </HKCard>

          {/* Columns */}
          <HKCard style={{ marginBottom: 20 }}>
            <p style={{ fontSize: TYPE.h2, fontWeight: 700, color: "var(--hk-text)", fontFamily: SG, margin: "0 0 20px" }}>
              Columns
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {columns.map((col, index) => (
                <div
                  key={index}
                  style={{
                    background: "var(--hk-bg)", border: "1px solid var(--hk-border)", borderRadius: 16,
                    padding: "16px", display: "flex", flexDirection: "column", gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    {/* Up/down controls */}
                    <div style={{
                      display: "flex", flexDirection: "column", gap: 2, alignItems: "center",
                      background: "var(--hk-badge)", borderRadius: 8, padding: "4px",
                    }}>
                      <button
                        onClick={() => moveColumn(index, index - 1)}
                        disabled={index === 0}
                        style={iconBtnStyle("var(--hk-sub)" as string, index === 0)}
                        aria-label="Move up"
                      >
                        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => moveColumn(index, index + 1)}
                        disabled={index === columns.length - 1}
                        style={iconBtnStyle("var(--hk-sub)" as string, index === columns.length - 1)}
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
                      background: PU + "18", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: TYPE.bodySmall, fontWeight: 700, color: PU, fontFamily: SG,
                    }}>
                      {index + 1}
                    </div>

                    {/* Name + Type inputs */}
                    <div style={{ flex: 1, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                      <HKInput
                        label="Column Name"
                        placeholder="e.g. Qty, Rate, Amount"
                        value={col.name}
                        onValueChange={(v) => updateColumn(index, "name", v)}
                        size="sm"
                        isRequired
                      />
                      <HKSelect
                        label="Type"
                        placeholder="Type"
                        value={col.type}
                        onValueChange={(val) => { if (val) updateColumn(index, "type", val); }}
                        size="sm"
                      >
                        {COLUMN_TYPES.map((t) => (
                          <HKSelectItem key={t.key} value={t.key}>{t.label}</HKSelectItem>
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
                        Build Formula
                      </p>
                      <HKInput
                        aria-label="Formula expression"
                        placeholder="e.g. {Qty} * {Rate}"
                        value={col.formula || ""}
                        onValueChange={(v) => updateColumn(index, "formula", v)}
                        isInvalid={!!errors[index]}
                        errorMessage={errors[index] || "Formula must be valid math. Supports +, -, *, /, ()"}
                      />
                      <div style={{ marginTop: 12 }}>
                        <p style={{ fontSize: TYPE.caption, color: "var(--hk-sub)", fontFamily: SG, marginBottom: 8, fontWeight: 600 }}>
                          Click to insert existing columns:
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
                            <span style={{ fontSize: TYPE.caption, color: "var(--hk-sub)", fontFamily: SG, fontStyle: "italic" }}>
                              No previous columns defined yet.
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
                        Dropdown Options
                      </p>
                      <HKInput
                        aria-label="Dropdown options"
                        placeholder="e.g. Main, Internal, Sliding"
                        value={(col.options || []).join(",")}
                        onValueChange={(v) => {
                          const newCols = [...columns];
                          newCols[index].options = v.split(",");
                          setColumns(newCols);
                        }}
                        description="Separate options with commas. Example: Option 1, Option 2"
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
              Add Another Column
            </button>
          </HKCard>

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <HKButton variant="secondary" onClick={() => router.push("/settings/templates")}>
              Cancel
            </HKButton>
            <HKButton onClick={handleSave} isLoading={saving}>
              Update Template
            </HKButton>
          </div>
        </div>
      </div>
    </>
  );
}
