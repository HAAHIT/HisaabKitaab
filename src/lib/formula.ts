// lib/formula.ts — Formula parser & evaluator for bill templates

interface ColumnDef {
  name: string;
  type: "text" | "number" | "formula" | "date" | "dropdown";
  formula?: string;
  options?: string[];
  position: number;
}

/**
 * Extract column names referenced in a formula.
 * E.g., "{Qty} * {Rate}" → ["Qty", "Rate"]
 */
export function extractReferences(formula: string): string[] {
  const matches = formula.match(/\{([^}]+)\}/g);
  if (!matches) return [];
  return matches.map((m) => m.slice(1, -1));
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Evaluate a formula given column definitions and current row values.
 * Returns the computed number, or null if inputs are missing.
 */
export function evaluateFormula(
  formula: string,
  rowValues: Record<string, number | string>,
  _columns: ColumnDef[]
): number | null {
  let expression = formula;
  const refs = extractReferences(formula);

  for (const ref of refs) {
    const value = rowValues[ref];
    if (value === undefined || value === "" || value === null) return null;
    const numValue = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(numValue)) return null;
    expression = expression.replace(
      new RegExp(`\\{${escapeRegex(ref)}\\}`, "g"),
      String(numValue)
    );
  }

  // Replace × with * and ÷ with /
  expression = expression.replace(/×/g, "*").replace(/÷/g, "/");

  try {
    const result = new Function(`return (${expression})`)();
    return typeof result === "number" && isFinite(result)
      ? Math.round(result * 100) / 100
      : null;
  } catch {
    return null;
  }
}

/**
 * Evaluate all formula columns in a single row, respecting dependency order.
 */
export function evaluateRow(
  rowValues: Record<string, number | string>,
  columns: ColumnDef[]
): Record<string, number | string> {
  const result = { ...rowValues };
  const sortedColumns = [...columns].sort((a, b) => a.position - b.position);

  for (const col of sortedColumns) {
    if (col.type === "formula" && col.formula) {
      const computed = evaluateFormula(col.formula, result, columns);
      if (computed !== null) {
        result[col.name] = computed;
      }
    }
  }

  return result;
}

/**
 * Validate a formula: check references exist, no circular deps, no self-reference.
 */
export function validateFormula(
  formula: string,
  columnName: string,
  columns: ColumnDef[]
): { valid: boolean; error?: string } {
  const refs = extractReferences(formula);
  const columnNames = columns.map((c) => c.name);
  const currentIndex = columns.findIndex((c) => c.name === columnName);

  if (refs.includes(columnName)) {
    return {
      valid: false,
      error: `Formula cannot reference itself (${columnName})`,
    };
  }

  for (const ref of refs) {
    if (!columnNames.includes(ref)) {
      return { valid: false, error: `Column "${ref}" does not exist` };
    }
    const refIndex = columns.findIndex((c) => c.name === ref);
    if (refIndex >= currentIndex) {
      return {
        valid: false,
        error: `Column "${ref}" must come before "${columnName}"`,
      };
    }
  }

  return { valid: true };
}

export type { ColumnDef };
