import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readStoredObject } from "@/lib/object-storage";
import { resolveReadTenant } from "@/lib/api-tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isDirectReadableStorageProvider(
  provider: string
): provider is "local" | "gcs" {
  return provider === "local" || provider === "gcs";
}

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
    try {
      const url = new URL(asset.storageKey);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return NextResponse.json({ error: "Invalid proxy URL" }, { status: 400 });
      }

      // Check for local/private IP ranges to prevent SSRF
      const hostname = url.hostname.toLowerCase();
      const isPrivateIP = (host: string) => {
        if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
        if (host.startsWith("10.")) return true; // 10.0.0.0/8
        if (host.startsWith("192.168.")) return true; // 192.168.0.0/16
        if (host.startsWith("169.254.")) return true; // 169.254.0.0/16

        // 172.16.0.0/12
        const match = host.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./);
        if (match) return true;

        return false;
      };

      if (isPrivateIP(hostname)) {
        return NextResponse.json({ error: "Forbidden proxy target" }, { status: 403 });
      }

      const proxyResponse = await fetch(asset.storageKey, {
        method: "GET",
        headers: {
          "User-Agent": "HisaabKitaab/1.0 AssetProxy",
        },
        // Limit the timeout to prevent hanging
        signal: AbortSignal.timeout(5000),
      });

      if (!proxyResponse.ok) {
        return NextResponse.json(
          { error: "Failed to fetch proxied asset" },
          { status: 502 }
        );
      }

      const contentType = proxyResponse.headers.get("content-type");
      if (contentType && !contentType.startsWith("image/")) {
        return NextResponse.json(
          { error: "Proxied asset must be an image" },
          { status: 400 }
        );
      }

      // Proxy the stream instead of loading the whole blob into memory (prevents DoS for large files)
      return new NextResponse(proxyResponse.body, {
        headers: {
          "Content-Type": contentType || asset.mimeType,
          "Cache-Control": "private, max-age=3600",
        },
      });
    } catch {
      return NextResponse.json(
        { error: "Invalid proxy configuration" },
        { status: 400 }
      );
    }
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
