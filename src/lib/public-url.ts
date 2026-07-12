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
  const baseUrl = getPublicBaseUrl(request);
  const url = new URL(pathOrUrl, baseUrl);
  const baseOrigin = new URL(baseUrl).origin;

  if (url.origin !== baseOrigin) {
    return new URL("/", baseUrl);
  }

  return url;
}
