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

/**
 * Fetches the current tenant and returns its serialized settings.
 *
 * Resolves the tenant for read access from the provided `request`; if tenant resolution fails the resolver's response is returned. If the tenant does not exist, returns `{ settings: null }`. On unexpected errors logs `settings.load.error` and returns `{ settings: null }` with HTTP 500.
 *
 * @param request - Incoming Next.js request used to resolve the tenant context
 * @returns The response body `{ settings: SerializedTenantSettings | null }` (serialized settings when a tenant is found, otherwise `null`)
 */
export async function GET(request: NextRequest) {
  try {
    const tenantResolution = resolveReadTenant(request);
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

/**
 * Update the current tenant's company settings (persisted in Tenant.settings) when the caller is an `ADMIN`.
 *
 * Merges normalized incoming fields into the existing tenant settings, updates top-level tenant fields used for search/indexing, and returns the serialized settings.
 *
 * @returns On success, an object `{ settings: ... }` containing the updated serialized tenant settings. On failure, one of:
 * - `{ error: "Forbidden" }` with HTTP 403 when the caller's role is not `ADMIN`.
 * - `{ error: "Tenant not found" }` with HTTP 404 when the resolved tenant does not exist.
 * - `{ error: "Internal server error" }` with HTTP 500 for unexpected errors.
 */
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

    const newSettings = mergeTenantSettings(existingTenant.settings as Record<string, unknown> | null, {
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

    return NextResponse.json({ settings: serializeTenantSettings(tenant) });
  } catch (error) {
    logError("settings.update.error", { requestId: getRequestId(request), error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
