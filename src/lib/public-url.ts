import type { NextRequest } from "next/server";

export function getPublicBaseUrl(request: NextRequest | Request): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    return `${forwardedProto || "https"}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}

export function publicUrl(
  request: NextRequest | Request,
  pathOrUrl: string
): URL {
  const baseString = getPublicBaseUrl(request);
  const baseUrl = new URL(baseString);

  try {
    const url = new URL(pathOrUrl, baseUrl);

    // Prevent Open Redirect and XSS by ensuring absolute URLs or scheme overrides
    // (e.g. javascript:alert(1), //evil.com, or opaque paths like urn:https://evil.com)
    // cannot bypass the base URL restriction.
    if (url.origin !== baseUrl.origin) {
      return new URL("/", baseUrl);
    }

    return url;
  } catch {
    return new URL("/", baseUrl);
  }
}
