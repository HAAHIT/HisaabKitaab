import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readStoredObject } from "@/lib/object-storage";
import { resolveReadTenant } from "@/lib/api-tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Determines whether a storage provider string denotes a directly readable provider.
 *
 * @returns `true` if `provider` is `"local"` or `"gcs"`, `false` otherwise.
 */
function isDirectReadableStorageProvider(
  provider: string
): provider is "local" | "gcs" {
  return provider === "local" || provider === "gcs";
}

/**
 * Serve a media asset identified by route `id`, enforcing tenant and role-based access controls and returning the file bytes or a redirect.
 *
 * @param request - Incoming request; requires `x-user-id` and `x-user-role` headers and is used to resolve tenant context.
 * @param params - Promise resolving to route parameters containing `id` of the requested asset.
 * @returns A `NextResponse` that is one of:
 * - 200 with the asset bytes, `Content-Type` set to the asset MIME type, and `Cache-Control: private, max-age=3600` when the file is readable.
 * - 302 redirect to the asset URL when the storage provider is `proxy`.
 * - 401 when authentication headers are missing.
 * - 403 when the resolved tenant or role is not authorized to access the asset.
 * - 404 when the asset record or the stored file is not found.
 * - 500 when the storage provider is unsupported.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role");

  if (!userId || !role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tenantResolution = resolveReadTenant(request);
  if (!tenantResolution.ok) {
    return tenantResolution.response;
  }
  const tenantId = tenantResolution.tenantId;

  const { id } = await params;

  const asset = await prisma.mediaAsset.findUnique({
    where: { id },
    select: {
      kind: true,
      storageProvider: true,
      storageKey: true,
      mimeType: true,
      measurementPhotos: {
        select: {
          measurement: {
            select: {
              customerId: true,
              tenantId: true,
            },
          },
        },
        take: 1,
      },
    },
  });

  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (
    asset.kind === "MEASUREMENT_PHOTO" &&
    !asset.measurementPhotos.some(
      (photo) => photo.measurement.tenantId === tenantId
    )
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (asset.kind === "COMPANY_LOGO") {
    const tenantLogoMatch = await prisma.tenant.findFirst({
      where: {
        id: tenantId,
        logoUrl: `/api/assets/${id}`,
      },
      select: { id: true },
    });
    if (!tenantLogoMatch) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (
    role === "CUSTOMER" &&
    asset.kind === "MEASUREMENT_PHOTO" &&
    !asset.measurementPhotos.some(
      (photo) => photo.measurement.customerId === userId
    )
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (asset.storageProvider === "proxy") {
    return NextResponse.redirect(asset.storageKey);
  }

  if (!isDirectReadableStorageProvider(asset.storageProvider)) {
    return NextResponse.json({ error: "Unsupported storage provider" }, { status: 500 });
  }

  try {
    const fileBuffer = await readStoredObject(
      asset.storageProvider as "local" | "gcs",
      asset.storageKey
    );
    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": asset.mimeType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }
}
