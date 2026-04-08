import { NextResponse, NextRequest } from "next/server";
import {
  buildMediaAssetCreateInputFromFile,
  deleteMediaAsset,
} from "@/lib/media";
import { prisma } from "@/lib/prisma";
import { resolveWriteTenant } from "@/lib/api-tenant";
import { serializeTenantSettings } from "@/lib/tenant-settings";
import { logError, getRequestId } from "@/lib/observability";

export const runtime = "nodejs";

/**
 * Determines whether the incoming request is from an admin user.
 *
 * @param request - The HTTP request whose `x-user-role` header will be checked
 * @returns `true` if the `x-user-role` header equals `"ADMIN"`, `false` otherwise.
 */
function isAdmin(request: Request) {
  return request.headers.get("x-user-role") === "ADMIN";
}

/**
 * Handles tenant logo upload: validates the uploaded file, creates a media asset, updates the tenant's `logoUrl`, and performs best-effort cleanup of any previous asset.
 *
 * Validates that the requester is an admin and that the target tenant can be resolved. Expects multipart form data with a `file` field that is an image no larger than 2 MB. On success returns the updated tenant settings serialized for the response; on failure returns an error JSON and, when possible, attempts to remove any newly created asset.
 *
 * @param request - The incoming NextRequest containing multipart form data with a `file` field
 * @returns A NextResponse with `{ settings: ... }` on success, or `{ error: string }` with an appropriate HTTP status on failure
 */
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const tenantResolution = await resolveWriteTenant(request);
  if (!tenantResolution.ok) {
    return tenantResolution.response;
  }
  const tenantId = tenantResolution.tenantId;

  let nextAsset:
    | Awaited<ReturnType<typeof buildMediaAssetCreateInputFromFile>>
    | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Logo file is required" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Logo must be an image" }, { status: 400 });
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Logo must be smaller than 2MB" },
        { status: 400 }
      );
    }

    nextAsset = await buildMediaAssetCreateInputFromFile({
      file,
      kind: "COMPANY_LOGO",
      namespace: "company-logos",
    });

    const previousTenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { logoUrl: true },
    });

    const asset = await prisma.mediaAsset.create({ data: nextAsset! });

    // Update the logo URL on the tenant
    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        logoUrl: `/api/assets/${asset.id}`,
      },
    });

    // Best effort cleanup of previous logo if it was a media asset
    if (previousTenant?.logoUrl && previousTenant.logoUrl.startsWith("/api/assets/")) {
      const oldId = previousTenant.logoUrl.replace("/api/assets/", "");
      const oldAsset = await prisma.mediaAsset.findUnique({ where: { id: oldId } });
      if (oldAsset) {
        await prisma.mediaAsset.delete({ where: { id: oldId } });
        await deleteMediaAsset(oldAsset);
      }
    }

    return NextResponse.json({
      settings: serializeTenantSettings(updatedTenant),
    });
  } catch (error) {
    if (nextAsset) {
      await deleteMediaAsset(nextAsset).catch(() => undefined);
    }

    logError("settings.logo.upload.error", { requestId: getRequestId(request), error });
    return NextResponse.json(
      { error: "Failed to upload logo" },
      { status: 500 }
    );
  }
}

/**
 * Deletes the current tenant logo, clears the tenant's `logoUrl`, and removes the underlying media asset if it was stored under `/api/assets/{id}`.
 *
 * @param request - The incoming NextRequest used for authorization and tenant resolution.
 * @returns A NextResponse containing JSON. On success: `{ settings: /* serialized tenant settings */ }`. On error: `{ error: string }` with an appropriate HTTP status (`403` for forbidden, `500` for server errors, or a tenant-resolution response).
 */
export async function DELETE(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const tenantResolution = await resolveWriteTenant(request);
  if (!tenantResolution.ok) {
    return tenantResolution.response;
  }
  const tenantId = tenantResolution.tenantId;

  try {
    const previousTenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { logoUrl: true },
    });

    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        logoUrl: null,
      },
    });

    // Cleanup
    if (previousTenant?.logoUrl && previousTenant.logoUrl.startsWith("/api/assets/")) {
      const oldId = previousTenant.logoUrl.replace("/api/assets/", "");
      const oldAsset = await prisma.mediaAsset.findUnique({ where: { id: oldId } });
      if (oldAsset) {
        await prisma.mediaAsset.delete({ where: { id: oldId } });
        await deleteMediaAsset(oldAsset);
      }
    }

    return NextResponse.json({
      settings: serializeTenantSettings(updatedTenant),
    });
  } catch (error) {
    logError("settings.logo.delete.error", { requestId: getRequestId(request), error });
    return NextResponse.json(
      { error: "Failed to delete logo" },
      { status: 500 }
    );
  }
}
