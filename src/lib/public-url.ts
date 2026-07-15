import type { NextRequest } from "next/server";

export function getPublicBaseUrl(request: NextRequest | Request): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  return request.url;
}

export function publicUrl(
  request: NextRequest | Request,
  pathOrUrl: string
): URL {
  return new URL(pathOrUrl, getPublicBaseUrl(request));
}
