import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { resolveReadTenant, resolveWriteTenant } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";
import {
  mergeTenantSettings,
  normalizeBusinessType,
  normalizeOptionalString,
  normalizeString,
  normalizeTaxPercent,
  normalizeTaxRegistrationType,
  serializeTenantSettings,
} from "@/lib/tenant-settings";

// GET /api/settings - Get company settings from Tenant record
export async function GET(request: NextRequest) {
  try {
    const tenantResolution = await resolveReadTenant(request);
    if (!tenantResolution.ok) {
      return tenantResolution.response;
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantResolution.tenantId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        gstin: true,
        logoUrl: true,
        settings: true,
      },
    });

    if (!tenant) {
      return NextResponse.json({ settings: null });
    }

    return NextResponse.json({ settings: serializeTenantSettings(tenant) });
  } catch (error) {
    logError("settings.load.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ settings: null }, { status: 500 });
  }
}

// PATCH /api/settings - Update company settings in Tenant.settings JSON
export async function PATCH(request: NextRequest) {
  const role = request.headers.get("x-user-role");

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantResolution = await resolveWriteTenant(request);
  if (!tenantResolution.ok) {
    return tenantResolution.response;
  }
  const tenantId = tenantResolution.tenantId;

  try {
    const body = await request.json();
    const existingTenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        settings: true,
      },
    });

    if (!existingTenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const companyName =
      normalizeOptionalString(body.companyName) ?? existingTenant.name;
    const companyAddress = normalizeOptionalString(body.companyAddress);
    const companyPhone = normalizeOptionalString(body.companyPhone);
    const companyEmail = normalizeOptionalString(body.companyEmail);
    const companyGstin = normalizeOptionalString(body.companyGstin);

    const nextSettings: Parameters<typeof mergeTenantSettings>[1] = {
      companyName,
      companyAddress: normalizeString(body.companyAddress),
      companyPhone: normalizeString(body.companyPhone),
      companyEmail: normalizeString(body.companyEmail),
      companyGstin: normalizeString(body.companyGstin),
      defaultTaxPercent: normalizeTaxPercent(body.defaultTaxPercent),
      defaultTerms: normalizeString(body.defaultTerms),
      billPrefix: normalizeString(body.billPrefix, "BILL"),
      upiId: normalizeString(body.upiId),
      businessType: normalizeBusinessType(body.businessType),
      taxRegistrationType: normalizeTaxRegistrationType(body.taxRegistrationType),
    };
    // Only update defaultTemplateId when explicitly provided in body
    if ("defaultTemplateId" in body) {
      nextSettings.defaultTemplateId = normalizeOptionalString(body.defaultTemplateId);
    }
    const newSettings = mergeTenantSettings(existingTenant.settings as Record<string, unknown> | null, nextSettings);

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        // Also update top-level tenant fields for index/search purposes
        name: newSettings.companyName || existingTenant.name,
        phone: companyPhone,
        email: companyEmail,
        address: companyAddress,
        gstin: companyGstin,
        settings: newSettings as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        gstin: true,
        logoUrl: true,
        settings: true,
      },
    });

    // [HOTFIX] Update isOnboardingComplete via raw SQL to bypass Prisma validation cache
    if (typeof body.isOnboardingComplete === "boolean") {
      await prisma.$executeRaw`
        UPDATE "Tenant"
        SET "isOnboardingComplete" = ${body.isOnboardingComplete}
        WHERE id = ${tenantId}
      `;
    }

    return NextResponse.json({ settings: serializeTenantSettings(tenant) });
  } catch (error) {
    logError("settings.update.error", { requestId: getRequestId(request), error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
