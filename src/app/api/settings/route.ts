import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/tenant";
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
export async function GET() {
  try {
    const tenantId = await getTenantId();
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
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
  } catch {
    return NextResponse.json({ settings: null });
  }
}

// PATCH /api/settings - Update company settings in Tenant.settings JSON
export async function PATCH(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const tenantId = await getTenantId();
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
    const companyAddressSetting = normalizeString(body.companyAddress);
    const companyPhoneSetting = normalizeString(body.companyPhone);
    const companyEmailSetting = normalizeString(body.companyEmail);
    const companyGstinSetting = normalizeString(body.companyGstin);

    const newSettings = mergeTenantSettings(existingTenant.settings, {
      companyName,
      companyAddress: companyAddressSetting,
      companyPhone: companyPhoneSetting,
      companyEmail: companyEmailSetting,
      companyGstin: companyGstinSetting,
      defaultTaxPercent: normalizeTaxPercent(body.defaultTaxPercent),
      defaultTerms: normalizeString(body.defaultTerms),
      billPrefix: normalizeString(body.billPrefix, "BILL"),
      upiId: normalizeString(body.upiId),
      businessType: normalizeBusinessType(body.businessType),
      taxRegistrationType: normalizeTaxRegistrationType(
        body.taxRegistrationType
      ),
    });

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        // Also update top-level tenant fields for index/search purposes
        name: newSettings.companyName || existingTenant.name,
        phone: companyPhone,
        email: companyEmail,
        address: companyAddress,
        gstin: companyGstin,
        settings: newSettings,
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

    return NextResponse.json({ settings: serializeTenantSettings(tenant) });
  } catch (error) {
    console.error("Update settings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
