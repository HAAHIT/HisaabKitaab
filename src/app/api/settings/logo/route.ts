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

function isAdmin(request: Request) {
  return request.headers.get("x-user-role") === "ADMIN";
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Missing user context" }, { status: 401 });
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

    // [MCA GSR 247(E)] Append-only audit log for logo upload
    await prisma.auditLog.create({
      data: {
        tenantId,
        entityType: "Tenant",
        entityId: tenantId,
        userId,
        action: "UPDATE",
        fieldName: "logoUrl",
        newValue: `/api/assets/${asset.id}`,
      },
    });

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

export async function DELETE(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Missing user context" }, { status: 401 });
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

    // [MCA GSR 247(E)] Append-only audit log for logo deletion
    await prisma.auditLog.create({
      data: {
        tenantId,
        entityType: "Tenant",
        entityId: tenantId,
        userId,
        action: "UPDATE",
        fieldName: "logoUrl",
        oldValue: previousTenant?.logoUrl || null,
        newValue: null,
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
