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
  const baseUrlStr = getPublicBaseUrl(request);
  const baseUrl = new URL(baseUrlStr);
  const finalUrl = new URL(pathOrUrl, baseUrl);

  if (finalUrl.origin !== baseUrl.origin) {
    throw new Error("Invalid URL: Cross-origin or absolute URL redirects are not allowed.");
  }

  return finalUrl;
}
