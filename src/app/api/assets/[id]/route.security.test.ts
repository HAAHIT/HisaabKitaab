import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSession } from "@/lib/api-tenant";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mediaAsset: {
      findUnique: vi.fn(),
    },
    tenant: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/api-tenant", () => ({
  resolveSession: vi.fn(),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Assets API Security - Open Redirect Fix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("proxies content instead of redirecting when storageProvider is proxy", async () => {
    const externalUrl = "https://trusted-site.com/image.jpg";
    const assetId = "test-asset-id";
    const tenantId = "test-tenant-id";
    const mockImageData = new Uint8Array([0, 1, 2, 3]);

    // Mock tenant resolution
    (resolveSession as import("vitest").Mock).mockReturnValue({
      ok: true,
      session: { tenantId, userId: "user-123", role: "CUSTOMER" },
    });

    // Mock asset lookup
    (prisma.mediaAsset.findUnique as import("vitest").Mock).mockResolvedValue({
      id: assetId,
      kind: "MEASUREMENT_PHOTO",
      storageProvider: "proxy",
      storageKey: externalUrl,
      mimeType: "image/jpeg",
      measurementPhotos: [
        {
          measurement: {
            customerId: "user-123",
            tenantId: tenantId,
          },
        },
      ],
    });

    // Mock successful fetch
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "image/jpeg" }),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(mockImageData);
          controller.close();
        },
      }),
    });

    const req = new NextRequest(`http://localhost/api/assets/${assetId}`, {
      headers: {
        "x-user-id": "user-123",
        "x-user-role": "CUSTOMER",
        "x-tenant-id": tenantId,
      },
    });

    const res = await GET(req, { params: Promise.resolve({ id: assetId }) });

    // Should NOT be a redirect
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("content-type")).toBe("image/jpeg");

    // Verify fetch was called with the correct URL
    expect(mockFetch).toHaveBeenCalledWith(externalUrl, expect.any(Object));
  });

  it("blocks SSRF attempts to private IP ranges", async () => {
    const internalUrl = "http://192.168.1.1/admin";
    const assetId = "test-asset-id";
    const tenantId = "test-tenant-id";

    (resolveSession as import("vitest").Mock).mockReturnValue({ ok: true, session: { tenantId, userId: "user-123", role: "CUSTOMER" } });
    (prisma.mediaAsset.findUnique as import("vitest").Mock).mockResolvedValue({
      id: assetId,
      kind: "MEASUREMENT_PHOTO",
      storageProvider: "proxy",
      storageKey: internalUrl,
      mimeType: "image/jpeg",
      measurementPhotos: [{ measurement: { customerId: "user-123", tenantId } }],
    });

    const req = new NextRequest(`http://localhost/api/assets/${assetId}`, {
      headers: {
        "x-user-id": "user-123",
        "x-user-role": "CUSTOMER",
      },
    });

    const res = await GET(req, { params: Promise.resolve({ id: assetId }) });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Forbidden proxy target");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("blocks SSRF attempts to private IPv6 addresses with brackets", async () => {
    const internalUrl = "http://[::1]/admin";
    const assetId = "test-asset-id";
    const tenantId = "test-tenant-id";

    (resolveSession as import("vitest").Mock).mockReturnValue({ ok: true, session: { tenantId, userId: "user-123", role: "CUSTOMER" } });
    (prisma.mediaAsset.findUnique as import("vitest").Mock).mockResolvedValue({
      id: assetId,
      kind: "MEASUREMENT_PHOTO",
      storageProvider: "proxy",
      storageKey: internalUrl,
      mimeType: "image/jpeg",
      measurementPhotos: [{ measurement: { customerId: "user-123", tenantId } }],
    });

    const req = new NextRequest(`http://localhost/api/assets/${assetId}`, {
      headers: {
        "x-user-id": "user-123",
        "x-user-role": "CUSTOMER",
      },
    });

    const res = await GET(req, { params: Promise.resolve({ id: assetId }) });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Forbidden proxy target");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("allows requests to domains that start with IP patterns", async () => {
    const externalUrl = "http://10.example.com/image.jpg";
    const assetId = "test-asset-id";
    const tenantId = "test-tenant-id";
    const mockImageData = new Uint8Array([0, 1, 2, 3]);

    (resolveSession as import("vitest").Mock).mockReturnValue({ ok: true, session: { tenantId, userId: "user-123", role: "CUSTOMER" } });
    (prisma.mediaAsset.findUnique as import("vitest").Mock).mockResolvedValue({
      id: assetId,
      kind: "MEASUREMENT_PHOTO",
      storageProvider: "proxy",
      storageKey: externalUrl,
      mimeType: "image/jpeg",
      measurementPhotos: [{ measurement: { customerId: "user-123", tenantId } }],
    });

    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "image/jpeg" }),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(mockImageData);
          controller.close();
        },
      }),
    });

    const req = new NextRequest(`http://localhost/api/assets/${assetId}`, {
      headers: {
        "x-user-id": "user-123",
        "x-user-role": "CUSTOMER",
      },
    });

    const res = await GET(req, { params: Promise.resolve({ id: assetId }) });

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(externalUrl, expect.any(Object));
  });

  it("blocks SSRF attempts to IPv4-mapped IPv6 loopback addresses", async () => {
    const internalUrl = "http://[::ffff:127.0.0.1]/admin";
    const assetId = "test-asset-id";
    const tenantId = "test-tenant-id";

    (resolveSession as import("vitest").Mock).mockReturnValue({ ok: true, session: { tenantId, userId: "user-123", role: "CUSTOMER" } });
    (prisma.mediaAsset.findUnique as import("vitest").Mock).mockResolvedValue({
      id: assetId,
      kind: "MEASUREMENT_PHOTO",
      storageProvider: "proxy",
      storageKey: internalUrl,
      mimeType: "image/jpeg",
      measurementPhotos: [{ measurement: { customerId: "user-123", tenantId } }],
    });

    const req = new NextRequest(`http://localhost/api/assets/${assetId}`, {
      headers: {
        "x-user-id": "user-123",
        "x-user-role": "CUSTOMER",
      },
    });

    const res = await GET(req, { params: Promise.resolve({ id: assetId }) });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Forbidden proxy target");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("blocks SSRF attempts to hex-encoded IPv4-mapped IPv6 loopback addresses", async () => {
    const internalUrl = "http://[::ffff:7f00:1]/admin";
    const assetId = "test-asset-id";
    const tenantId = "test-tenant-id";

    (resolveSession as import("vitest").Mock).mockReturnValue({ ok: true, session: { tenantId, userId: "user-123", role: "CUSTOMER" } });
    (prisma.mediaAsset.findUnique as import("vitest").Mock).mockResolvedValue({
      id: assetId,
      kind: "MEASUREMENT_PHOTO",
      storageProvider: "proxy",
      storageKey: internalUrl,
      mimeType: "image/jpeg",
      measurementPhotos: [{ measurement: { customerId: "user-123", tenantId } }],
    });

    const req = new NextRequest(`http://localhost/api/assets/${assetId}`, {
      headers: {
        "x-user-id": "user-123",
        "x-user-role": "CUSTOMER",
      },
    });

    const res = await GET(req, { params: Promise.resolve({ id: assetId }) });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Forbidden proxy target");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("blocks non-image content types from proxy", async () => {
    const externalUrl = "https://trusted-site.com/script.sh";
    const assetId = "test-asset-id";
    const tenantId = "test-tenant-id";

    (resolveSession as import("vitest").Mock).mockReturnValue({ ok: true, session: { tenantId, userId: "user-123", role: "CUSTOMER" } });
    (prisma.mediaAsset.findUnique as import("vitest").Mock).mockResolvedValue({
      id: assetId,
      kind: "MEASUREMENT_PHOTO",
      storageProvider: "proxy",
      storageKey: externalUrl,
      mimeType: "image/jpeg",
      measurementPhotos: [{ measurement: { customerId: "user-123", tenantId } }],
    });

    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "text/x-shellscript" }),
    });

    const req = new NextRequest(`http://localhost/api/assets/${assetId}`, {
      headers: {
        "x-user-id": "user-123",
        "x-user-role": "CUSTOMER",
      },
    });

    const res = await GET(req, { params: Promise.resolve({ id: assetId }) });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Proxied asset must be an image");
  });
});
