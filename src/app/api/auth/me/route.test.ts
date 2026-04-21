import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const prismaMock = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
  },
}));

const getSessionMock = vi.hoisted(() => vi.fn());
const resolveVerifiedTenantIdMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/auth", () => ({
  getSession: getSessionMock,
}));

// [LB-1] resolveReadTenant now verifies JWT via session-server
vi.mock("@/lib/session-server", () => ({
  resolveVerifiedTenantId: resolveVerifiedTenantIdMock,
}));

import { GET } from "./route";

describe("GET /api/auth/me tenant isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes user lookup by tenantId", async () => {
    // [LB-1] Mock JWT-verified tenant resolution
    resolveVerifiedTenantIdMock.mockResolvedValue("tenant-a");
    getSessionMock.mockResolvedValue({
      userId: "user-1",
      tenantId: "tenant-a",
      name: "Admin",
      role: "ADMIN",
    });
    prismaMock.user.findFirst.mockResolvedValue({
      id: "user-1",
      tenantId: "tenant-a",
      name: "Admin",
      email: null,
      phone: null,
      role: "ADMIN",
      isActive: true,
    });

    const request = new NextRequest("http://localhost/api/auth/me", {
      headers: {
        "x-tenant-id": "tenant-a",
      },
    });

    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "user-1",
          tenantId: "tenant-a",
          isActive: true,
        }),
      })
    );
  });

  it("rejects request when session tenant and request tenant mismatch", async () => {
    // [LB-1] Mock JWT returning null (failed verification)
    resolveVerifiedTenantIdMock.mockResolvedValue(null);
    getSessionMock.mockResolvedValue({
      userId: "user-1",
      tenantId: "tenant-b",
      name: "Admin",
      role: "ADMIN",
    });

    const request = new NextRequest("http://localhost/api/auth/me", {
      headers: {
        "x-tenant-id": "tenant-a",
      },
    });

    const response = await GET(request);
    // [LB-1] resolveReadTenant now returns 500 (tenant context missing) when JWT fails
    expect(response.status).toBe(500);
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
  });
});
