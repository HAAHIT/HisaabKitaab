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

export function normalizeItemUnit(value: unknown): ItemUnit {
  if (typeof value === "string" && ITEM_UNITS.includes(value as ItemUnit)) {
    return value as ItemUnit;
  }

  return "pcs";
}

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
