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
  return request.url;
}

export function publicUrl(
  request: NextRequest | Request,
  pathOrUrl: string
): URL {
  const baseUrl = new URL(getPublicBaseUrl(request));
  try {
    const url = new URL(pathOrUrl, baseUrl);
    if (url.origin !== baseUrl.origin) {
      return new URL("/", baseUrl);
    }
    return url;
  } catch {
    return new URL("/", baseUrl);
  }
}
