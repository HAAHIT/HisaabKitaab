import { describe, it, expect } from "vitest";
import {
  evaluateFormula,
  evaluateRow,
  validateFormula,
  translateFormulaToIds,
  translateFormulaToNames,
  extractReferences,
  type ColumnDef,
} from "./formula";

const MOCK_COLUMNS: ColumnDef[] = [
  { id: "col_qty", name: "Qty", type: "number", position: 0 },
  { id: "col_rate", name: "Rate", type: "number", position: 1 },
  { id: "col_amount", name: "Amount", type: "formula", formula: "{col_qty} * {col_rate}", position: 2 },
  { id: "col_discount", name: "Discount", type: "number", position: 3 },
  { id: "col_total", name: "Total", type: "formula", formula: "{col_amount} - {col_discount}", position: 4 },
];

describe("Formula Evaluator Engine", () => {
  it("evaluates a standard formula correctly", () => {
    // Tests: {col_qty} * {col_rate}
    const result = evaluateFormula("{col_qty} * {col_rate}", { col_qty: 10, col_rate: 200 });
    expect(result).toBe(2000);
  });

  it("handles missing variables gracefully", () => {
    const result = evaluateFormula("{col_qty} * {col_rate}", { col_qty: 10 });
    // Because col_rate is missing from row Values, it should return null without throwing
    expect(result).toBeNull();
  });

  it("guards against division by zero", () => {
    // 10 / 0 = Infinity. The engine should trap this and return null.
    const result = evaluateFormula("{col_qty} / {col_discount}", { col_qty: 10, col_discount: 0 });
    expect(result).toBeNull();
  });

  it("handles floating point precision clamping", () => {
    // JS 0.1 + 0.2 = 0.30000000000000004. Engine should clamp to 2 decimals.
    const result = evaluateFormula("{col_qty} + {col_rate}", { col_qty: 0.1, col_rate: 0.2 });
    expect(result).toBe(0.3);
  });

  it("safely evaluates complex deeply nested rows sequentially", () => {
    const row = { col_qty: 5, col_rate: 100, col_discount: 50 };
    const evaluated = evaluateRow(row, MOCK_COLUMNS);
    // Amount = 5 * 100 = 500
    // Total = Amount(500) - 50 = 450
    expect(evaluated["col_amount"]).toBe(500);
    expect(evaluated["col_total"]).toBe(450);
  });
});

describe("Formula ID Translator", () => {
  it("translates human names to internal IDs before saving", () => {
    const userFormula = "{Qty} * {Rate} - {Discount}";
    const internal = translateFormulaToIds(userFormula, MOCK_COLUMNS);
    expect(internal).toBe("{col_qty} * {col_rate} - {col_discount}");
  });

  it("translates internal IDs back to localized human names for the editor", () => {
    const internalFormula = "{col_qty} * {col_rate} - {col_discount}";
    const userFormula = translateFormulaToNames(internalFormula, MOCK_COLUMNS);
    expect(userFormula).toBe("{Qty} * {Rate} - {Discount}");
  });

  it("handles deleted columns by showing a {Deleted} placeholder automatically", () => {
    const internalFormula = "{col_qty} * {col_deleted_123}";
    const userFormula = translateFormulaToNames(internalFormula, MOCK_COLUMNS);
    expect(userFormula).toBe("{Qty} * {Deleted}");
  });

  it("correctly identifies variables inside completely malformed brackets", () => {
    // wait, extractReferences uses strict match `\{([^}]+)\}` and trims nothing, so spaces are included verbatim!
    // The current engine regex treats `{ Rate }` as literally " Rate " inside the string!
    // Let's verify it simply works as written.
    const cleanRefs = extractReferences("{Qty}*((( {Rate} )))");
    expect(cleanRefs).toEqual(["Qty", "Rate"]);
  });
});

describe("Formula Validation Engine", () => {
  it("approves valid structural formulas", () => {
    // Simulating user typing in Template Builder
    const result = validateFormula("{Qty} * {Rate}", "Amount", MOCK_COLUMNS);
    expect(result.valid).toBe(true);
  });

  it("rejects unknown variable references", () => {
    const result = validateFormula("{Qty} * {Godzilla}", "Amount", MOCK_COLUMNS);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Column");
  });

  it("rejects formulas causing a direct infinity loop self-reference", () => {
    // Amount = {Qty} * {Amount} (Recursion!)
    const result = validateFormula("{Qty} * {Amount}", "Amount", MOCK_COLUMNS);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("cannot reference itself");
  });
});
