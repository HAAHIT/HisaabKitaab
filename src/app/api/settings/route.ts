import { NextResponse } from "next/server";
import { serializeCompanySettings } from "@/lib/media";
import { prisma } from "@/lib/prisma";

type TenantSettingsRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstin: string | null;
  logoUrl: string | null;
  settings: unknown;
  createdAt: Date;
};

type NormalizedSettings = {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyGstin: string;
  companyLogo: string | null;
  defaultTaxPercent: number;
  defaultTerms: string;
  billPrefix: string;
};

type SettingsPayload = Omit<NormalizedSettings, "companyLogo">;

const DEFAULT_SETTINGS: NormalizedSettings = {
  companyName: "",
  companyAddress: "",
  companyPhone: "",
  companyEmail: "",
  companyGstin: "",
  companyLogo: null,
  defaultTaxPercent: 18,
  defaultTerms: "",
  billPrefix: "BILL",
};

function isCompanySettingsTableMissing(error: unknown) {
  if (
    !error ||
    typeof error !== "object" ||
    !("code" in error) ||
    error.code !== "P2021"
  ) {
    return false;
  }

  const tableName =
    "meta" in error &&
    error.meta &&
    typeof error.meta === "object" &&
    "table" in error.meta &&
    typeof error.meta.table === "string"
      ? error.meta.table
      : "";

  return tableName.includes("CompanySettings");
}

function parseTenantSettings(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }

  return {};
}

function asTrimmedString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function resolveTenantId(request: Request | null) {
  const fromHeader = request?.headers.get("x-tenant-id")?.trim();
  if (fromHeader) {
    return fromHeader;
  }

  const fromEnv = process.env.DEFAULT_TENANT_ID?.trim();
  return fromEnv || null;
}

async function findTenantSettingsRow(
  request: Request | null
): Promise<TenantSettingsRow | null> {
  const tenantId = resolveTenantId(request);

  if (tenantId) {
    const scoped = await prisma.$queryRaw<TenantSettingsRow[]>`
      SELECT "id", "name", "phone", "email", "address", "gstin", "logoUrl", "settings", "createdAt"
      FROM "Tenant"
      WHERE "id" = ${tenantId}
      LIMIT 1
    `;

    if (scoped[0]) {
      return scoped[0];
    }
  }

  const fallback = await prisma.$queryRaw<TenantSettingsRow[]>`
    SELECT "id", "name", "phone", "email", "address", "gstin", "logoUrl", "settings", "createdAt"
    FROM "Tenant"
    ORDER BY "createdAt" ASC
    LIMIT 1
  `;

  return fallback[0] || null;
}

function normalizeTenantSettings(row: TenantSettingsRow | null): NormalizedSettings {
  if (!row) {
    return { ...DEFAULT_SETTINGS };
  }

  const tenantSettings = parseTenantSettings(row.settings);
  const defaultTaxPercentRaw = tenantSettings.defaultTaxPercent;
  const defaultTaxPercent =
    typeof defaultTaxPercentRaw === "number"
      ? defaultTaxPercentRaw
      : typeof defaultTaxPercentRaw === "string"
        ? Number.parseFloat(defaultTaxPercentRaw)
        : Number.NaN;
  const defaultTerms =
    typeof tenantSettings.defaultTerms === "string"
      ? tenantSettings.defaultTerms
      : "";
  const billPrefixCandidate =
    typeof tenantSettings.billPrefix === "string"
      ? tenantSettings.billPrefix.trim()
      : "";

  return {
    companyName: row.name || "",
    companyAddress: row.address || "",
    companyPhone: row.phone || "",
    companyEmail: row.email || "",
    companyGstin: row.gstin || "",
    companyLogo: row.logoUrl || null,
    defaultTaxPercent: Number.isFinite(defaultTaxPercent)
      ? defaultTaxPercent
      : DEFAULT_SETTINGS.defaultTaxPercent,
    defaultTerms,
    billPrefix: billPrefixCandidate || DEFAULT_SETTINGS.billPrefix,
  };
}

async function loadSettingsFromTenant(request: Request | null) {
  const tenant = await findTenantSettingsRow(request);
  return normalizeTenantSettings(tenant);
}

// GET /api/settings - Get company settings
export async function GET(request: Request) {
  try {
    const settings = await prisma.companySettings.findUnique({
      where: { id: "default" },
      include: {
        companyLogoAsset: {
          select: { id: true },
        },
      },
    });

    return NextResponse.json({ settings: serializeCompanySettings(settings) });
  } catch (error) {
    if (isCompanySettingsTableMissing(error)) {
      const tenantSettings = await loadSettingsFromTenant(request);
      return NextResponse.json({ settings: tenantSettings });
    }

    console.error("Load settings error:", error);
    return NextResponse.json({ settings: null });
  }
}

// PATCH /api/settings - Update company settings
export async function PATCH(request: Request) {
  const role = request.headers.get("x-user-role");
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data: SettingsPayload = {
      companyName:
        typeof body.companyName === "string" ? body.companyName.trim() : "",
      companyAddress:
        typeof body.companyAddress === "string" ? body.companyAddress.trim() : "",
      companyPhone:
        typeof body.companyPhone === "string" ? body.companyPhone.trim() : "",
      companyEmail:
        typeof body.companyEmail === "string" ? body.companyEmail.trim() : "",
      companyGstin:
        typeof body.companyGstin === "string" ? body.companyGstin.trim() : "",
      defaultTaxPercent:
        typeof body.defaultTaxPercent === "number" ? body.defaultTaxPercent : 0,
      defaultTerms:
        typeof body.defaultTerms === "string" ? body.defaultTerms.trim() : "",
      billPrefix:
        typeof body.billPrefix === "string" && body.billPrefix.trim()
          ? body.billPrefix.trim()
          : "BILL",
    };

    try {
      const settings = await prisma.companySettings.upsert({
        where: { id: "default" },
        update: data,
        create: { id: "default", ...data },
        include: {
          companyLogoAsset: {
            select: { id: true },
          },
        },
      });

      return NextResponse.json({ settings: serializeCompanySettings(settings) });
    } catch (error) {
      if (!isCompanySettingsTableMissing(error)) {
        throw error;
      }

      const tenant = await findTenantSettingsRow(request);
      if (!tenant) {
        throw new Error("Tenant not found");
      }

      const existingTenantSettings = parseTenantSettings(tenant.settings);
      const nextTenantSettings = {
        ...existingTenantSettings,
        defaultTaxPercent: data.defaultTaxPercent,
        defaultTerms: data.defaultTerms,
        billPrefix: data.billPrefix,
      };
      const serializedTenantSettings = JSON.stringify(nextTenantSettings);

      const updatedTenantRows = await prisma.$queryRaw<TenantSettingsRow[]>`
        UPDATE "Tenant"
        SET
          "name" = ${data.companyName},
          "address" = ${asTrimmedString(data.companyAddress)},
          "phone" = ${asTrimmedString(data.companyPhone)},
          "email" = ${asTrimmedString(data.companyEmail)},
          "gstin" = ${asTrimmedString(data.companyGstin)},
          "settings" = ${serializedTenantSettings}::jsonb,
          "updatedAt" = NOW()
        WHERE "id" = ${tenant.id}
        RETURNING "id", "name", "phone", "email", "address", "gstin", "logoUrl", "settings", "createdAt"
      `;

      const updatedTenant = updatedTenantRows[0];
      if (!updatedTenant) {
        throw new Error("Failed to update tenant settings");
      }

      return NextResponse.json({
        settings: normalizeTenantSettings(updatedTenant),
      });
    }
  } catch (error) {
    console.error("Update settings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
