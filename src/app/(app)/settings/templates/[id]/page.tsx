"use client";

import { useState, useEffect, use } from "react";
import {
  Card,
  CardBody,
  Input,
  Button,
  Select,
  SelectItem,
  Skeleton,
  Chip,
} from "@heroui/react";
import { useRouter } from "next/navigation";
import { validateFormula, translateFormulaToNames, translateFormulaToIds, type ColumnDef } from "@/lib/formula";

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
  
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [columns, setColumns] = useState<ColumnDef[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  useEffect(() => {
    fetch(`/api/templates/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Template not found");
        return res.json();
      })
      .then((data) => {
        const decodedColumns = data.template.columns.map((col: ColumnDef) => {
          if (col.type === "formula" && col.formula) {
            return {
              ...col,
              formula: translateFormulaToNames(col.formula, data.template.columns)
            };
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
      .finally(() => {
        setLoading(false);
      });
  }, [id, router]);

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

    if (!name.trim()) {
      showToast("Template name is required", "error");
      return false;
    }

    const colNames = new Set<string>();
    columns.forEach((col, i) => {
      if (!col.name.trim()) {
        newErrors[i] = "Column name is required";
        valid = false;
        return;
      }
      if (colNames.has(col.name)) {
        newErrors[i] = "Duplicate column name";
        valid = false;
        return;
      }
      colNames.add(col.name);

      if (col.type === "formula") {
        if (!col.formula?.trim()) {
          newErrors[i] = "Formula is required";
          valid = false;
          return;
        }
        const result = validateFormula(col.formula, col.name, columns);
        if (!result.valid) {
          newErrors[i] = result.error || "Invalid formula";
          valid = false;
        }
      }
    });

    setErrors(newErrors);
    return valid;
  }

  async function handleSave() {
    if (!validateAll()) return;

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
      showToast(
        err instanceof Error ? err.message : "Failed to update",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 lg:p-8 space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-60 w-full rounded-xl" />
      </div>
    );
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
          <h1 className="text-2xl font-bold">Edit Template</h1>
          <p className="text-default-500 text-sm mt-1">
            Update columns and formulas
          </p>
        </div>
      </div>

      <Card shadow="sm" className="mb-6">
        <CardBody className="p-6">
          <Input
            label="Template Name"
            placeholder="e.g. Order Invoice"
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
          <h2 className="text-lg font-semibold mb-4">Columns</h2>

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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => moveColumn(index, index + 1)}
                      disabled={index === columns.length - 1}
                      className="text-default-400 hover:text-default-600 disabled:opacity-30 transition"
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
                      label="Column Name"
                      placeholder="e.g. Qty, Rate, Amount"
                      value={col.name}
                      onValueChange={(v) => updateColumn(index, "name", v)}
                      variant="bordered"
                      size="sm"
                      isRequired
                    />
                    <Select
                      label="Type"
                      placeholder="Type"
                      selectedKeys={new Set([col.type])}
                      onSelectionChange={(keys) => {
                        const val = Array.from(keys)[0] as string;
                        if (val) updateColumn(index, "type", val);
                      }}
                      variant="bordered"
                      size="sm"
                    >
                      {COLUMN_TYPES.map((t) => (
                        <SelectItem key={t.key} textValue={t.label}>{t.label}</SelectItem>

                      ))}
                    </Select>
                  </div>

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
                      Build Formula
                    </p>
                    <Input
                      aria-label="Formula expression"
                      placeholder="e.g. {Qty} * {Rate}"
                      value={col.formula || ""}
                      onValueChange={(v) => updateColumn(index, "formula", v)}
                      variant="faded"
                      isInvalid={!!errors[index]}
                      errorMessage={errors[index] || "Formula must be valid math. Supports +, -, *, /, ()"}
                    />
                    
                    <div className="mt-4">
                      <p className="text-xs text-default-500 mb-2 font-medium">Click to insert existing columns:</p>
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
                          <span className="text-xs text-default-400 italic">No previous columns defined yet. Add columns above to use them in formulas.</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {col.type === "dropdown" && (
                  <div className="ml-0 md:ml-16 p-4 rounded-xl bg-primary-50 dark:bg-primary/10 border border-primary/20">
                    <p className="text-sm font-semibold text-primary-700 dark:text-primary-500 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
                      Dropdown Options
                    </p>
                    <Input
                      aria-label="Dropdown options"
                      placeholder="e.g. Main, Internal, Sliding"
                      value={(col.options || []).join(",")}
                      onValueChange={(v) => {
                        const newCols = [...columns];
                        newCols[index].options = v.split(",");
                        setColumns(newCols);
                      }}
                      variant="faded"
                      description="Separate options with commas. Example: Option 1, Option 2"
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
            Add Another Column
          </Button>
        </CardBody>
      </Card>

      <div className="flex gap-3 justify-end">
        <Button
          variant="flat"
          onPress={() => router.push("/settings/templates")}
        >
          Cancel
        </Button>
        <Button
          color="primary"
          className="bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold"
          onPress={handleSave}
          isLoading={saving}
        >
          Update Template
        </Button>
      </div>
    </div>
  );
}
