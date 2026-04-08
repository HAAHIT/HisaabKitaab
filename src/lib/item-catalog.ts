export const ITEM_UNITS = [
  "pcs",
  "kg",
  "ltr",
  "meter",
  "sqft",
  "box",
  "set",
  "pair",
  "nos",
] as const;

export type ItemUnit = (typeof ITEM_UNITS)[number];

/**
 * Normalize an arbitrary value to a valid ItemUnit.
 *
 * @param value - Input to validate as an item unit; may be any type.
 * @returns The input cast to an `ItemUnit` if it matches one of the allowed units, `"pcs"` otherwise.
 */
export function normalizeItemUnit(value: unknown): ItemUnit {
  if (typeof value === "string" && ITEM_UNITS.includes(value as ItemUnit)) {
    return value as ItemUnit;
  }

  return "pcs";
}

/**
 * Normalize an arbitrary input into a numeric quantity rounded to two decimal places or `null` if invalid.
 *
 * If `value` is `undefined`, `null`, or the empty string `""`, `fallback` is returned.
 *
 * @param value - The input to normalize (number, numeric string, or other)
 * @param fallback - The value to return when `value` is `undefined`, `null`, or `""` (defaults to `0`)
 * @returns A number rounded to two decimal places if `value` parses to a finite number, `null` if it cannot be parsed, or `fallback` when `value` is missing/empty
 */
export function normalizeItemNumber(
  value: unknown,
  fallback: number | null = 0
): number | null {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.round(parsed * 100) / 100;
}
