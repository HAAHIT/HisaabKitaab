// lib/formula.ts — Formula parser & evaluator for bill templates

export interface ColumnDef {
  id: string;
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

type MathToken =
  | { type: "number"; value: number }
  | { type: "operator"; value: "+" | "-" | "*" | "/" | "%" }
  | { type: "paren"; value: "(" | ")" };

function tokenizeMathExpression(expression: string): MathToken[] | null {
  const tokens: MathToken[] = [];
  let index = 0;

  while (index < expression.length) {
    const character = expression[index];

    if (/\s/.test(character)) {
      index += 1;
      continue;
    }

    if (/[0-9.]/.test(character)) {
      let end = index + 1;
      while (end < expression.length && /[0-9.]/.test(expression[end])) {
        end += 1;
      }

      const rawValue = expression.slice(index, end);
      if ((rawValue.match(/\./g) || []).length > 1) {
        return null;
      }

      const value = Number.parseFloat(rawValue);
      if (!Number.isFinite(value)) {
        return null;
      }

      tokens.push({ type: "number", value });
      index = end;
      continue;
    }

    if (character === "(" || character === ")") {
      tokens.push({ type: "paren", value: character });
      index += 1;
      continue;
    }

    if (character === "+" || character === "-" || character === "*" || character === "/" || character === "%") {
      tokens.push({ type: "operator", value: character });
      index += 1;
      continue;
    }

    return null;
  }

  return tokens;
}

function evaluateMathExpression(expression: string): number | null {
  const parsedTokens = tokenizeMathExpression(expression);
  if (!parsedTokens || parsedTokens.length === 0) {
    return null;
  }
  const tokens = parsedTokens;

  let index = 0;

  function parseExpression(): number | null {
    let left = parseTerm();
    if (left === null) {
      return null;
    }

    while (
      index < tokens.length &&
      tokens[index].type === "operator" &&
      (tokens[index].value === "+" || tokens[index].value === "-")
    ) {
      const operator = tokens[index].value;
      index += 1;
      const right = parseTerm();
      if (right === null) {
        return null;
      }

      left = operator === "+" ? left + right : left - right;
    }

    return left;
  }

  function parseTerm(): number | null {
    let left = parseUnary();
    if (left === null) {
      return null;
    }

    while (
      index < tokens.length &&
      tokens[index].type === "operator" &&
      (tokens[index].value === "*" || tokens[index].value === "/" || tokens[index].value === "%")
    ) {
      const operator = tokens[index].value;
      index += 1;
      const right = parseUnary();
      if (right === null) {
        return null;
      }

      if (operator === "*") {
        left *= right;
      } else if (operator === "/") {
        if (right === 0) {
          return null;
        }
        left /= right;
      } else {
        if (right === 0) {
          return null;
        }
        left %= right;
      }
    }

    return left;
  }

  function parseUnary(): number | null {
    if (
      index < tokens.length &&
      tokens[index].type === "operator" &&
      (tokens[index].value === "+" || tokens[index].value === "-")
    ) {
      const operator = tokens[index].value;
      index += 1;
      const value = parseUnary();
      if (value === null) {
        return null;
      }

      return operator === "-" ? -value : value;
    }

    return parsePrimary();
  }

  function parsePrimary(): number | null {
    const token = tokens[index];
    if (!token) {
      return null;
    }

    if (token.type === "number") {
      index += 1;
      return token.value;
    }

    if (token.type === "paren" && token.value === "(") {
      index += 1;
      const value = parseExpression();
      if (
        value === null ||
        index >= tokens.length ||
        tokens[index].type !== "paren" ||
        tokens[index].value !== ")"
      ) {
        return null;
      }

      index += 1;
      return value;
    }

    return null;
  }

  const result = parseExpression();
  if (result === null || index !== tokens.length || !Number.isFinite(result)) {
    return null;
  }

  return result;
}

/**
 * Evaluate a formula given column definitions and current row values.
 * Returns the computed number, or null if inputs are missing.
 */
export function evaluateFormula(
  formula: string,
  rowValues: Record<string, number | string>
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

  const result = evaluateMathExpression(expression);
  if (result === null) {
    return null;
  }

  return Math.round(result * 100) / 100;
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
      const computed = evaluateFormula(col.formula, result);
      if (computed !== null) {
        result[col.id] = computed;
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

/** Translates user-facing {Name} to internal {id} */
export function translateFormulaToIds(userFormula: string, columns: ColumnDef[]): string {
  if (!userFormula) return "";
  let result = userFormula;
  const refs = extractReferences(userFormula);
  for (const ref of refs) {
    const col = columns.find(c => c.name === ref);
    if (col) {
      result = result.replace(new RegExp(`\\{${escapeRegex(ref)}\\}`, "g"), `{${col.id}}`);
    }
  }
  return result;
}

/** Translates internal {id} to user-facing {Name} */
export function translateFormulaToNames(internalFormula: string, columns: ColumnDef[]): string {
  if (!internalFormula) return "";
  let result = internalFormula;
  const refs = extractReferences(internalFormula);
  for (const ref of refs) {
    const col = columns.find(c => c.id === ref);
    if (col) {
      result = result.replace(new RegExp(`\\{${escapeRegex(ref)}\\}`, "g"), `{${col.name}}`);
    } else {
      result = result.replace(new RegExp(`\\{${escapeRegex(ref)}\\}`, "g"), `{Deleted}`);
    }
  }
  return result;
}
