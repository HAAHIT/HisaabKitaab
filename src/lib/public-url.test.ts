import type { NextRequest } from "next/server";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getPublicBaseUrl } from "./public-url";

describe("getPublicBaseUrl", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("prioritizes NEXT_PUBLIC_SITE_URL over request headers", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://secure-site.com";

    const request = {
      url: "http://localhost:3000/some-path",
      headers: {
        get: (name: string) => {
          if (name === "x-forwarded-host") return "evil.com";
          if (name === "x-forwarded-proto") return "http";
          return null;
        }
      }
    } as unknown as NextRequest;

    const result = getPublicBaseUrl(request);
    expect(result).toBe("https://secure-site.com");
  });

  it("falls back to headers if NEXT_PUBLIC_SITE_URL is not set", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;

    const request = {
      url: "http://localhost:3000/some-path",
      headers: {
        get: (name: string) => {
          if (name === "x-forwarded-host") return "trusted.com";
          if (name === "x-forwarded-proto") return "https";
          return null;
        }
      }
    } as unknown as NextRequest;

    const result = getPublicBaseUrl(request);
    expect(result).toBe("https://trusted.com");
  });

  it("falls back to request.url if headers are not set", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;

    const request = {
      url: "http://localhost:3000/some-path",
      headers: {
        get: () => null
      }
    } as unknown as NextRequest;

    const result = getPublicBaseUrl(request);
    expect(result).toBe("http://localhost:3000/some-path");
  });
});
