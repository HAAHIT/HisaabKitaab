import { NextResponse, NextRequest } from "next/server";
import {
  buildMediaAssetCreateInputFromFile,
  deleteMediaAsset,
} from "@/lib/media";
import { prisma } from "@/lib/prisma";
import { resolveSession } from "@/lib/api-tenant";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { serializeTenantSettings } from "@/lib/tenant-settings";
import { logError, getRequestId } from "@/lib/observability";

export const runtime = "nodejs";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ASSET_ID_REGEX = /^[a-zA-Z0-9_-]{16,64}$/;

// Magic byte signatures for the image formats we accept. File.type is
// client-supplied and can be spoofed, so we verify the binary header.
function detectImageMime(bytes: Uint8Array): string | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return "image/gif";
  }
  return null;
}

function extractAssetId(logoUrl: string | null | undefined): string | null {
  if (!logoUrl || !logoUrl.startsWith("/api/assets/")) return null;
  const candidate = logoUrl.slice("/api/assets/".length);
  return ASSET_ID_REGEX.test(candidate) ? candidate : null;
}

async function cleanupPreviousLogo(oldId: string, tenantId: string) {
  // Defense in depth: only delete if the asset is a COMPANY_LOGO and no other
  // tenant currently references it. MediaAsset has no tenantId column, so the
  // tenant scoping is enforced via the referencing tenant.logoUrl.
  const oldAsset = await prisma.mediaAsset.findFirst({
    where: { id: oldId, kind: "COMPANY_LOGO" },
  });
  if (!oldAsset) return;

  const otherReference = await prisma.tenant.findFirst({
    where: { id: { not: tenantId }, logoUrl: `/api/assets/${oldId}` },
    select: { id: true },
  });
  if (otherReference) return;

  await prisma.mediaAsset.delete({ where: { id: oldId } });
  await deleteMediaAsset(oldAsset);
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = await checkRateLimit(request, "settings.logo.upload", 10);
  if (rateLimitResponse) return rateLimitResponse;

  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, userId, role } = sessionResolution.session;

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let nextAsset:
    | Awaited<ReturnType<typeof buildMediaAssetCreateInputFromFile>>
    | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Logo file is required" }, { status: 400 });
    }

    if (file.size > MAX_LOGO_BYTES) {
      return NextResponse.json(
        { error: "Logo must be smaller than 2MB" },
        { status: 400 }
      );
    }

    const headerBytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const detectedMime = detectImageMime(headerBytes);
    if (!detectedMime) {
      return NextResponse.json(
        { error: "Logo must be a PNG, JPEG, WebP, or GIF image" },
        { status: 400 }
      );
    }

    nextAsset = await buildMediaAssetCreateInputFromFile({
      file,
      kind: "COMPANY_LOGO",
      namespace: "company-logos",
    });
    // Override the client-supplied mime with the verified one
    nextAsset.mimeType = detectedMime;

    const { updatedTenant, oldAssetId } = await prisma.$transaction(async (tx) => {
      const previousTenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { logoUrl: true },
      });

      const asset = await tx.mediaAsset.create({ data: nextAsset! });

      const updated = await tx.tenant.update({
        where: { id: tenantId },
        data: { logoUrl: `/api/assets/${asset.id}` },
      });

      // [MCA GSR 247(E)] Append-only audit log for logo upload
      await tx.auditLog.create({
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

      return {
        updatedTenant: updated,
        oldAssetId: extractAssetId(previousTenant?.logoUrl),
      };
    });

    if (oldAssetId) {
      // Best-effort cleanup outside the transaction so a stale orphan never
      // blocks the user-visible update.
      await cleanupPreviousLogo(oldAssetId, tenantId).catch((error) => {
        logError("settings.logo.cleanup.error", {
          requestId: getRequestId(request),
          error,
        });
      });
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

export async function DELETE(request: NextRequest) {
  const rateLimitResponse = await checkRateLimit(request, "settings.logo.delete", 10);
  if (rateLimitResponse) return rateLimitResponse;

  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, userId, role } = sessionResolution.session;

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { updatedTenant, oldAssetId } = await prisma.$transaction(async (tx) => {
      const previousTenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { logoUrl: true },
      });

      const updated = await tx.tenant.update({
        where: { id: tenantId },
        data: { logoUrl: null },
      });

      // [MCA GSR 247(E)] Append-only audit log for logo deletion
      await tx.auditLog.create({
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

      return {
        updatedTenant: updated,
        oldAssetId: extractAssetId(previousTenant?.logoUrl),
      };
    });

    if (oldAssetId) {
      await cleanupPreviousLogo(oldAssetId, tenantId).catch((error) => {
        logError("settings.logo.cleanup.error", {
          requestId: getRequestId(request),
          error,
        });
      });
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
