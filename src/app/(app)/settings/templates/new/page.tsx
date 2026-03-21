"use client";

import { useState } from "react";
import {
  Card,
  CardBody,
  Input,
  Button,
  Select,
  SelectItem,
} from "@heroui/react";
import { useRouter } from "next/navigation";
import { validateFormula, type ColumnDef } from "@/lib/formula";

const COLUMN_TYPES = [
  { key: "text", label: "Text" },
  { key: "number", label: "Number" },
  { key: "formula", label: "Formula" },
  { key: "date", label: "Date" },
  { key: "dropdown", label: "Dropdown" },
];

export default function CreateTemplatePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [columns, setColumns] = useState<ColumnDef[]>([
    { name: "", type: "text", position: 0 },
  ]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  function addColumn() {
    setColumns([
      ...columns,
      { name: "", type: "text", position: columns.length },
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

  function validateAll(): boolean {
    const newErrors: Record<number, string> = {};
    let valid = true;

    // Check template name
    if (!name.trim()) {
      showToast("Template name is required", "error");
      return false;
    }

    // Check column names
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

      // Validate formula
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

    setSaving(true);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, columns }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast("Template created!", "success");
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
          <h1 className="text-2xl font-bold">Create Template</h1>
          <p className="text-default-500 text-sm mt-1">
            Define columns for your invoice layout
          </p>
        </div>
      </div>

      <Card shadow="sm" className="mb-6">
        <CardBody className="p-6">
          <Input
            label="Template Name"
            placeholder="e.g. Door Order Invoice"
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
                className="flex flex-col gap-3 p-4 rounded-xl bg-default-50 dark:bg-default-100/5 border border-default-200"
              >
                <div className="flex items-center gap-2">
                  {/* Position and reorder buttons */}
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => moveColumn(index, index - 1)}
                      disabled={index === 0}
                      className="text-default-400 hover:text-default-600 disabled:opacity-30 transition"
                    >
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
                          d="M5 15l7-7 7 7"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => moveColumn(index, index + 1)}
                      disabled={index === columns.length - 1}
                      className="text-default-400 hover:text-default-600 disabled:opacity-30 transition"
                    >
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
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                  </div>

                  <span className="text-sm font-mono text-default-400 w-6">
                    {index + 1}
                  </span>

                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
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
                      selectedKeys={[col.type]}
                      onSelectionChange={(keys) => {
                        const val = Array.from(keys)[0] as string;
                        if (val) updateColumn(index, "type", val);
                      }}
                      variant="bordered"
                      size="sm"
                    >
                      {COLUMN_TYPES.map((t) => (
                        <SelectItem key={t.key}>{t.label}</SelectItem>
                      ))}
                    </Select>
                  </div>

                  {/* Delete button */}
                  <Button
                    isIconOnly
                    size="sm"
                    variant="flat"
                    color="danger"
                    onPress={() => removeColumn(index)}
                    isDisabled={columns.length === 1}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </Button>
                </div>

                {/* Formula input — only shown for formula type */}
                {col.type === "formula" && (
                  <div className="ml-12">
                    <Input
                      label="Formula"
                      placeholder="e.g. {Qty} * {Rate (₹)}"
                      value={col.formula || ""}
                      onValueChange={(v) => updateColumn(index, "formula", v)}
                      variant="bordered"
                      size="sm"
                      description="Use {ColumnName} to reference other columns. Supports +, -, *, /, ()"
                      isInvalid={!!errors[index]}
                      errorMessage={errors[index]}
                    />
                  </div>
                )}

                {/* Dropdown options — only shown for dropdown type */}
                {col.type === "dropdown" && (
                  <div className="ml-12">
                    <Input
                      label="Options (comma-separated)"
                      placeholder="e.g. Main Door, Internal Door, Sliding Door"
                      value={(col.options || []).join(", ")}
                      onValueChange={(v) => {
                        const newCols = [...columns];
                        newCols[index].options = v
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean);
                        setColumns(newCols);
                      }}
                      variant="bordered"
                      size="sm"
                    />
                  </div>
                )}

                {/* Error for non-formula cols */}
                {errors[index] && col.type !== "formula" && (
                  <p className="text-danger text-xs ml-12">{errors[index]}</p>
                )}
              </div>
            ))}
          </div>

          <Button
            variant="flat"
            className="mt-4"
            onPress={addColumn}
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
            Add Column
          </Button>
        </CardBody>
      </Card>

      {/* Actions */}
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
          Save Template
        </Button>
      </div>
    </div>
  );
}
