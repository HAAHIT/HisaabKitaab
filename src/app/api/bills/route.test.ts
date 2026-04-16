import { describe, it, expect } from "vitest";
import { POST, GET } from "./route";
import { NextRequest } from "next/server";

// We test the API boundaries without needing to mock Prisma,
// as the failure should occur at the validation validation layer BEFORE hitting the DB for bad data.

describe("Bills API Endpoint Protection", () => {
  it("GET rejects unauthorized users instantly", async () => {
    const req = new NextRequest("http://localhost/api/bills");
    // No role header
    const res = await GET(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Forbidden");
  });

  it("GET rejects CUSTOMER role instantly", async () => {
    const req = new NextRequest("http://localhost/api/bills", {
      headers: { "x-user-role": "CUSTOMER" },
    });
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("POST rejects missing payload completely", async () => {
    const prevDefaultTenantId = process.env.DEFAULT_TENANT_ID;
    const req = new NextRequest("http://localhost/api/bills", {
      method: "POST",
      headers: {
        "x-user-role": "ADMIN",
        "x-user-id": "test-user",
        "x-tenant-id": "test-tenant",
        // Pass the tenant ID directly via the fallback environment variable for tests
      },
      body: JSON.stringify({}),
    });
    process.env.DEFAULT_TENANT_ID = "test-tenant";
    try {
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Customer name is required");
    } finally {
      if (prevDefaultTenantId === undefined) delete process.env.DEFAULT_TENANT_ID;
      else process.env.DEFAULT_TENANT_ID = prevDefaultTenantId;
    }
  });

  it("POST rejects missing customer name", async () => {
    const prevDefaultTenantId = process.env.DEFAULT_TENANT_ID;
    const req = new NextRequest("http://localhost/api/bills", {
      method: "POST",
      headers: {
        "x-user-role": "STAFF",
        "x-user-id": "test-user",
        "x-tenant-id": "test-tenant",
      },
      body: JSON.stringify({
        templateId: "tmpl_123",
        rows: [],
        // Missing customer name
      }),
    });
    process.env.DEFAULT_TENANT_ID = "test-tenant";
    try {
      const res = await POST(req);
      expect(res.status).toBe(400);
    } finally {
      if (prevDefaultTenantId === undefined) delete process.env.DEFAULT_TENANT_ID;
      else process.env.DEFAULT_TENANT_ID = prevDefaultTenantId;
    }
  });
});
