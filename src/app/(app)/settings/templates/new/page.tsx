"use client";

import { useState } from "react";
import {
  Card,
  CardBody,
  Input,
  Button,
  Select,
  SelectItem,
  Chip,
} from "@heroui/react";
import { useRouter } from "next/navigation";
import { validateFormula, translateFormulaToIds, type ColumnDef } from "@/lib/formula";
import { useLanguage } from "@/contexts/LanguageContext";

export default function CreateTemplatePage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [columns, setColumns] = useState<ColumnDef[]>([
    { id: crypto.randomUUID(), name: "", type: "text", position: 0 },
  ]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

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
    setColumns([
      ...columns,
      { id: crypto.randomUUID(), name: "", type: "text", position: columns.length },
    ]);
  }

  function removeColumn(index: number) {
    // Check if any formula references this column
    const colName = columns[index].name;
    const dependents = columns.filter(
      (c) =>
        c.type === "formula" &&
        c.formula &&
        c.formula.includes(`{${colName}}`)
    );

    if (dependents.length > 0 && colName) {
      const names = dependents.map((d) => d.name).join(", ");
      if (
        !confirm(
          `This column is used in formulas for: ${names}. Delete anyway?`
        )
      )
        return;
    }

    const newCols = columns.filter((_, i) => i !== index);
    newCols.forEach((c, i) => (c.position = i));
    setColumns(newCols);
  }

  function updateColumn(
    index: number,
    field: keyof ColumnDef,
    value: string
  ) {
    const newCols = [...columns];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newCols[index] as any)[field] = value;
    setColumns(newCols);

    // Clear error for this column
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

    // Check template name
    if (!name.trim()) {
      showToast(t("templates.nameRequired"), "error");
      return false;
    }

    // Check column names
    const colNames = new Set<string>();
    columns.forEach((col, i) => {
      if (!col.name.trim()) {
        newErrors[i] = t("templates.columnRequired");
        valid = false;
        return;
      }
      if (colNames.has(col.name)) {
        newErrors[i] = t("templates.duplicateColumn");
        valid = false;
        return;
      }
      colNames.add(col.name);

      // Validate formula
      if (col.type === "formula") {
        if (!col.formula?.trim()) {
          newErrors[i] = t("templates.formulaRequired");
          valid = false;
          return;
        }
        const result = validateFormula(col.formula, col.name, columns);
        if (!result.valid) {
          newErrors[i] = result.error || t("templates.invalidFormula");
          valid = false;
        }
      }
    });

    setErrors(newErrors);
    return valid;
  }

  async function handleSave() {
    if (!validateAll()) return;

    // Translate formulas to use persistent IDs before securing perfectly to database
    const encodedColumns = columns.map(col => {
      if (col.type === "formula" && col.formula) {
        return {
          ...col,
          formula: translateFormulaToIds(col.formula, columns)
        };
      }
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
      showToast(
        err instanceof Error ? err.message : "Failed to save",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 lg:p-8 animate-fade-in max-w-4xl mx-auto">
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

      <div className="flex items-center gap-3 mb-6">
        <Button
          isIconOnly
          variant="light"
          aria-label="Back to templates"
          onPress={() => router.push("/settings/templates")}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{t("templates.createTitle")}</h1>
          <p className="text-default-500 text-sm mt-1">
            {t("templates.createSubtitle")}
          </p>
        </div>
      </div>

      <Card shadow="sm" className="mb-6">
        <CardBody className="p-6">
          <Input
            label={t("templates.templateName")}
            placeholder={t("templates.templateNamePlaceholder")}
            value={name}
            onValueChange={setName}
            variant="bordered"
            size="lg"
            isRequired
          />
        </CardBody>
      </Card>

      <Card shadow="sm" className="mb-6">
        <CardBody className="p-6">
          <h2 className="text-lg font-semibold mb-4">{t("templates.columns")}</h2>

          <div className="space-y-4">
            {columns.map((col, index) => (
              <div
                key={index}
                className="flex flex-col gap-4 p-5 rounded-2xl bg-default-50 border shadow-sm border-default-200 transition-all hover:border-primary/30"
              >
                <div className="flex items-start md:items-center gap-4">
                  <div className="flex flex-col gap-1 items-center bg-default-100 dark:bg-default-200/50 rounded-lg p-1">
                    <button
                      onClick={() => moveColumn(index, index - 1)}
                      disabled={index === 0}
                      className="text-default-400 hover:text-primary disabled:opacity-30 transition p-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 15l7-7 7 7"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => moveColumn(index, index + 1)}
                      disabled={index === columns.length - 1}
                      className="text-default-400 hover:text-primary disabled:opacity-30 transition p-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                    {index + 1}
                  </span>

                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label={t("templates.columnName")}
                      placeholder={t("templates.columnNamePlaceholder")}
                      value={col.name}
                      onValueChange={(v) => updateColumn(index, "name", v)}
                      variant="bordered"
                      size="sm"
                      isRequired
                    />
                    <Select
                      label={t("templates.type")}
                      placeholder={t("templates.type")}
                      selectedKeys={new Set([col.type])}
                      onSelectionChange={(keys) => {
                        const val = Array.from(keys)[0] as string;
                        if (val) updateColumn(index, "type", val);
                      }}
                      variant="bordered"
                      size="sm"
                    >
                      {columnTypeOptions.map((option) => (
                        <SelectItem key={option.key}>{option.label}</SelectItem>
                      ))}
                    </Select>
                  </div>

                  {/* Delete button */}
                  <Button
                    isIconOnly
                    variant="flat"
                    color="danger"
                    aria-label={`Remove column ${index + 1}`}
                    onPress={() => removeColumn(index)}
                    isDisabled={columns.length === 1}
                    className="mt-1 md:mt-0"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </Button>
                </div>

                {col.type === "formula" && (
                  <div className="ml-0 md:ml-16 p-4 rounded-xl bg-warning-50 dark:bg-warning/10 border border-warning/20">
                    <p className="text-sm font-semibold text-warning-700 dark:text-warning-500 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      {t("templates.buildFormula")}
                    </p>
                    <Input
                      aria-label={t("templates.buildFormula")}
                      placeholder={t("templates.formulaPlaceholder")}
                      value={col.formula || ""}
                      onValueChange={(v) => updateColumn(index, "formula", v)}
                      variant="faded"
                      isInvalid={!!errors[index]}
                      errorMessage={errors[index] || t("templates.formulaHelp")}
                    />
                    
                    <div className="mt-4">
                      <p className="text-xs text-default-500 mb-2 font-medium">{t("templates.insertColumns")}</p>
                      <div className="flex flex-wrap gap-2">
                        {columns.slice(0, index).filter(c => c.name.trim()).length > 0 ? (
                          columns.slice(0, index).filter(c => c.name.trim()).map((prevCol, i) => (
                            <Chip 
                              key={i} 
                              size="sm" 
                              variant="flat" 
                              color="warning"
                              className="cursor-pointer hover:bg-warning-200 transition px-2 py-4 shadow-sm"
                              onClick={() => appendToFormula(index, prevCol.name)}
                            >
                              <span className="font-mono text-sm">{prevCol.name}</span>
                            </Chip>
                          ))
                        ) : (
                          <span className="text-xs text-default-400 italic">{t("templates.noPreviousColumns")}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {col.type === "dropdown" && (
                  <div className="ml-0 md:ml-16 p-4 rounded-xl bg-primary-50 dark:bg-primary/10 border border-primary/20">
                    <p className="text-sm font-semibold text-primary-700 dark:text-primary-500 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
                      {t("templates.dropdownOptions")}
                    </p>
                    <Input
                      aria-label={t("templates.dropdownOptions")}
                      placeholder={t("templates.dropdownPlaceholder")}
                      value={(col.options || []).join(",")}
                      onValueChange={(v) => {
                        const newCols = [...columns];
                        newCols[index].options = v.split(",");
                        setColumns(newCols);
                      }}
                      variant="faded"
                      description={t("templates.dropdownDescription")}
                    />
                  </div>
                )}

                {errors[index] && col.type !== "formula" && (
                  <p className="text-danger text-sm ml-0 md:ml-16 font-medium">{errors[index]}</p>
                )}
              </div>
            ))}
          </div>

          <Button
            variant="flat"
            className="mt-4"
            onPress={addColumn}
            startContent={
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            {t("templates.addColumn")}
          </Button>
        </CardBody>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button
          variant="flat"
          onPress={() => router.push("/settings/templates")}
        >
          {t("common.cancel")}
        </Button>
        <Button
          color="primary"
          className="bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold"
          onPress={handleSave}
          isLoading={saving}
        >
          {t("templates.saveTemplate")}
        </Button>
      </div>
    </div>
  );
}
