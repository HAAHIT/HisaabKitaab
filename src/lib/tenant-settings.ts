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

function getFlatTenantSettings(settings: unknown): FlatTenantSettings {
  if (settings && typeof settings === "object" && !Array.isArray(settings)) {
    return settings as FlatTenantSettings;
  }

  return {};
}

export function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function normalizeString(value: unknown, fallback = ""): string {
  return normalizeOptionalString(value) ?? fallback;
}

export function normalizeBusinessType(value: unknown): BusinessType {
  if (typeof value === "string" && BUSINESS_TYPES.includes(value as BusinessType)) {
    return value as BusinessType;
  }

  return "INDIVIDUAL";
}

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
    defaultTemplateId: normalizeOptionalString(settings.defaultTemplateId),
  };
}

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
    defaultTemplateId: string | null;
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
    defaultTemplateId:
      "defaultTemplateId" in nextSettings
        ? nextSettings.defaultTemplateId ?? null
        : normalizeOptionalString(existing.defaultTemplateId),
  };
}
