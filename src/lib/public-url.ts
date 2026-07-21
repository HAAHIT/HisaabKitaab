import type { NextRequest } from "next/server";

export function getPublicBaseUrl(request: NextRequest | Request): string {
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
  const url = new URL(pathOrUrl, baseUrl);

  if (url.origin === "null" || url.origin !== baseUrl.origin) {
    return new URL("/", baseUrl);
  }

  return url;
}
