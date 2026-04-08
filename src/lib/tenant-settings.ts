export const BUSINESS_TYPES = [
  "INDIVIDUAL",
  "PARTNERSHIP",
  "PVT_LTD",
  "LLP",
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const TAX_REGISTRATION_TYPES = [
  "REGISTERED",
  "UNREGISTERED",
] as const;

export type TaxRegistrationType = (typeof TAX_REGISTRATION_TYPES)[number];

type FlatTenantSettings = Record<string, unknown>;

interface TenantSettingsSource {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  gstin?: string | null;
  logoUrl?: string | null;
  settings?: unknown;
}

/**
 * Convert arbitrary input into a flat tenant settings object or an empty record.
 *
 * @param settings - Input value that may contain tenant settings; only a non-null plain object (not an array) is treated as valid.
 * @returns The original object cast as `FlatTenantSettings` when valid, otherwise an empty object.
 */
function getFlatTenantSettings(settings: unknown): FlatTenantSettings {
  if (settings && typeof settings === "object" && !Array.isArray(settings)) {
    return settings as FlatTenantSettings;
  }

  return {};
}

/**
 * Return the trimmed input when it contains non-whitespace characters.
 *
 * @param value - Input to normalize; non-string values or strings that are empty/whitespace produce `null`
 * @returns The trimmed string if `value` contained non-whitespace characters, `null` otherwise
 */
export function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Produce a trimmed string from the given value or the provided fallback.
 *
 * @param value - The value to normalize; only a string with non-whitespace characters is returned trimmed.
 * @param fallback - Value to use when `value` is not a non-empty string (defaults to `""`).
 * @returns The trimmed input string if `value` is a string with non-whitespace characters, otherwise `fallback`.
 */
export function normalizeString(value: unknown, fallback = ""): string {
  return normalizeOptionalString(value) ?? fallback;
}

/**
 * Normalize an input value to a valid business type.
 *
 * @param value - The input to validate and convert into a `BusinessType`.
 * @returns The matched `BusinessType` if `value` is one of the allowed types, otherwise `INDIVIDUAL`.
 */
export function normalizeBusinessType(value: unknown): BusinessType {
  if (typeof value === "string" && BUSINESS_TYPES.includes(value as BusinessType)) {
    return value as BusinessType;
  }

  return "INDIVIDUAL";
}

/**
 * Normalize an input to a recognized tax registration type.
 *
 * @param value - Candidate value to normalize into a tax registration type
 * @returns `'REGISTERED'` or `'UNREGISTERED'`; returns `'REGISTERED'` when `value` is not one of the allowed types
 */
export function normalizeTaxRegistrationType(
  value: unknown
): TaxRegistrationType {
  if (
    typeof value === "string" &&
    TAX_REGISTRATION_TYPES.includes(value as TaxRegistrationType)
  ) {
    return value as TaxRegistrationType;
  }

  return "REGISTERED";
}

/**
 * Normalize an input into a tax percentage value between 0 and 100 with two-decimal precision.
 *
 * @param value - A number or numeric string to parse as a percentage; other values are treated as invalid.
 * @returns The parsed percentage rounded to two decimals and clamped to the range 0–100. If `value` cannot be parsed to a finite number, returns `18`.
 */
export function normalizeTaxPercent(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return 18;
  }

  return Math.min(100, Math.max(0, Math.round(parsed * 100) / 100));
}

/**
 * Produce a normalized, flat settings object derived from a TenantSettingsSource.
 *
 * @param tenant - Source tenant data; may include top-level name/phone/email/address/gstin/logoUrl and a freeform `settings` object
 * @returns An object with normalized tenant settings:
 * - `companyName`, `companyPhone`, `companyEmail`, `companyAddress`, `companyGstin` — trimmed strings using `tenant.settings` values when present, falling back to top-level tenant fields or sensible defaults
 * - `companyLogo`, `companyLogoUrl` — `tenant.logoUrl` or `null`
 * - `billPrefix` — trimmed string defaulting to `"BILL"` when unspecified
 * - `defaultTaxPercent` — number clamped to the range 0–100 with a default of 18
 * - `defaultTerms`, `upiId` — trimmed strings (or empty string)
 * - `businessType` — validated business type (defaults to `"INDIVIDUAL"`)
 * - `taxRegistrationType` — validated tax registration type (defaults to `"REGISTERED"`)
 */
export function serializeTenantSettings(tenant: TenantSettingsSource) {
  const settings = getFlatTenantSettings(tenant.settings);
  const companyLogo = tenant.logoUrl ?? null;

  return {
    companyName: normalizeString(settings.companyName, tenant.name),
    companyPhone: normalizeString(settings.companyPhone, tenant.phone ?? ""),
    companyEmail: normalizeString(settings.companyEmail, tenant.email ?? ""),
    companyAddress: normalizeString(settings.companyAddress, tenant.address ?? ""),
    companyGstin: normalizeString(settings.companyGstin, tenant.gstin ?? ""),
    companyLogo,
    companyLogoUrl: companyLogo,
    billPrefix: normalizeString(settings.billPrefix, "BILL"),
    defaultTaxPercent: normalizeTaxPercent(settings.defaultTaxPercent),
    defaultTerms: normalizeString(settings.defaultTerms),
    upiId: normalizeString(settings.upiId),
    businessType: normalizeBusinessType(settings.businessType),
    taxRegistrationType: normalizeTaxRegistrationType(
      settings.taxRegistrationType
    ),
  };
}

/**
 * Merge partial tenant updates into existing tenant settings, producing a flattened, normalized settings object.
 *
 * @param currentSettings - Existing tenant settings of any shape; will be flattened and used as the source of defaults.
 * @param nextSettings - Partial updates to apply; properties that are `null` or `undefined` will not overwrite existing values.
 * @returns An object with normalized tenant settings:
 * - `companyName`, `companyPhone`, `companyEmail`, `companyAddress`, `companyGstin`, `billPrefix`, `defaultTerms`, `upiId` as strings (with `billPrefix` defaulting to `"BILL"` when absent),
 * - `defaultTaxPercent` as a number (normalized and clamped to `[0,100]` with a default of `18`),
 * - `businessType` and `taxRegistrationType` as their respective validated enum values.
 */
export function mergeTenantSettings(
  currentSettings: unknown,
  nextSettings: Partial<{
    companyName: string | null;
    companyPhone: string | null;
    companyEmail: string | null;
    companyAddress: string | null;
    companyGstin: string | null;
    billPrefix: string | null;
    defaultTaxPercent: number;
    defaultTerms: string | null;
    upiId: string | null;
    businessType: BusinessType;
    taxRegistrationType: TaxRegistrationType;
  }>
) {
  const existing = getFlatTenantSettings(currentSettings);

  return {
    ...existing,
    companyName: nextSettings.companyName ?? normalizeString(existing.companyName),
    companyPhone:
      nextSettings.companyPhone ?? normalizeString(existing.companyPhone),
    companyEmail:
      nextSettings.companyEmail ?? normalizeString(existing.companyEmail),
    companyAddress:
      nextSettings.companyAddress ?? normalizeString(existing.companyAddress),
    companyGstin:
      nextSettings.companyGstin ?? normalizeString(existing.companyGstin),
    billPrefix: nextSettings.billPrefix ?? normalizeString(existing.billPrefix, "BILL"),
    defaultTaxPercent:
      nextSettings.defaultTaxPercent ??
      normalizeTaxPercent(existing.defaultTaxPercent),
    defaultTerms:
      nextSettings.defaultTerms ?? normalizeString(existing.defaultTerms),
    upiId: nextSettings.upiId ?? normalizeString(existing.upiId),
    businessType:
      nextSettings.businessType ?? normalizeBusinessType(existing.businessType),
    taxRegistrationType:
      nextSettings.taxRegistrationType ??
      normalizeTaxRegistrationType(existing.taxRegistrationType),
  };
}
