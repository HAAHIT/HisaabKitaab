const TRUE_VALUES = new Set(["1", "true", "yes", "on", "enabled"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off", "disabled"]);

/**
 * Parse a string into a boolean feature flag using accepted truthy/falsy values, falling back to a default.
 *
 * @param value - The input string to interpret; accepted truthy values are "1", "true", "yes", "on", "enabled" and accepted falsy values are "0", "false", "no", "off", "disabled". Leading/trailing whitespace is ignored and comparison is case-insensitive.
 * @param defaultValue - Fallback returned when `value` is `undefined`, empty, or not one of the accepted values.
 * @returns `true` if `value` matches an accepted truthy string, `false` if it matches an accepted falsy string, otherwise `defaultValue`.
 */
function readBooleanFlag(
  value: string | undefined,
  defaultValue: boolean
): boolean {
  if (!value) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) {
    return true;
  }

  if (FALSE_VALUES.has(normalized)) {
    return false;
  }

  return defaultValue;
}

export const FEATURE_FLAGS = {
  // Controls visibility of measurement-related navigation in the UI.
  measurementsUi: readBooleanFlag(
    process.env.NEXT_PUBLIC_FEATURE_MEASUREMENTS_UI,
    true
  ),
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;
