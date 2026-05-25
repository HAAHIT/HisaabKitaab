const TRUE_VALUES = new Set(["1", "true", "yes", "on", "enabled"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off", "disabled"]);

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
  testingWipeData: readBooleanFlag(
    process.env.NEXT_PUBLIC_FEATURE_TESTING_WIPE_DATA,
    false
  ),
  testingDeleteTenant: readBooleanFlag(
    process.env.NEXT_PUBLIC_FEATURE_TESTING_DELETE_TENANT,
    false
  ),
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;
