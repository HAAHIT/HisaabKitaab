import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readStoredObject } from "@/lib/object-storage";
import { resolveSession } from "@/lib/api-tenant";

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
  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, userId, role } = sessionResolution.session;

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

      // Node.js `URL.hostname` preserves the surrounding brackets from `[::1]`,
      // so we must strip them to compare the bare textual host. We intentionally
      // only block hosts that *parse* as a private literal — DNS rebinding (a
      // public hostname that resolves to a private address) is mitigated separately
      // by running the proxy in a network namespace without metadata access. A safer
      // alternative is dns.lookup + re-check after the fetch handshake, but
      // that requires a custom http.Agent and is out of scope here.
      const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
      const isPrivateIPv4 = (host: string) => {
        if (host === "localhost" || host === "127.0.0.1") return true;
        if (host.startsWith("10.")) return true;             // 10.0.0.0/8
        if (host.startsWith("192.168.")) return true;        // 192.168.0.0/16
        if (host.startsWith("169.254.")) return true;        // 169.254.0.0/16 (incl. cloud metadata)
        if (host.startsWith("0.") || host === "0.0.0.0") return true; // 0.0.0.0/8
        if (/^127\./.test(host)) return true;                // entire 127.0.0.0/8 loopback
        if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) return true; // 172.16.0.0/12
        return false;
      };
      const isPrivateIPv6 = (host: string) => {
        if (host === "::1" || host === "::") return true;
        if (host.startsWith("fe80:") || host.startsWith("fe80::")) return true; // link-local
        if (/^f[cd][0-9a-f]{2}:/.test(host)) return true;    // fc00::/7 unique-local
        // IPv4-mapped (::ffff:127.0.0.1) and IPv4-compatible (::127.0.0.1) — check the embedded v4
        const v4Mapped = host.match(/^(?:::ffff:|::)([0-9.]+)$/);
        if (v4Mapped && isPrivateIPv4(v4Mapped[1])) return true;
        return false;
      };
      if (isPrivateIPv4(hostname) || isPrivateIPv6(hostname)) {
        return NextResponse.json({ error: "Forbidden proxy target" }, { status: 403 });
      }

      let proxyResponse: Response | null = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        proxyResponse = await fetch(asset.storageKey, {
          method: "GET",
          headers: { "User-Agent": "SoloBooks/1.0 AssetProxy" },
          signal: AbortSignal.timeout(5000),
        });
        // Only retry on server-side errors — 4xx means the resource is
        // definitively absent or forbidden, retrying will not help.
        if (proxyResponse.ok || proxyResponse.status < 500) break;
      }

      if (!proxyResponse || !proxyResponse.ok) {
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
