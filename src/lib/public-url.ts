import type { NextRequest } from "next/server";

export function getPublicBaseUrl(request: NextRequest | Request): string {
  // 🛡️ SENTINEL: Use securely configured NEXT_PUBLIC_SITE_URL to prevent Host Header Injection.
  // Relying on `x-forwarded-host` or `Host` headers can allow an attacker to forge absolute URLs
  // (e.g., for password resets) pointing to their own domains.
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    return `${forwardedProto || "https"}://${forwardedHost}`;
  }
  return request.url;
}

export function publicUrl(
  request: NextRequest | Request,
  pathOrUrl: string
): URL {
  return new URL(pathOrUrl, getPublicBaseUrl(request));
}
