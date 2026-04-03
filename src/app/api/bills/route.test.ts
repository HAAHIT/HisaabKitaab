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
    const req = new NextRequest("http://localhost/api/bills", {
      method: "POST",
      headers: { "x-user-role": "ADMIN", "x-user-id": "test-user" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("are required");
  });

  it("POST rejects missing customer name", async () => {
    const req = new NextRequest("http://localhost/api/bills", {
      method: "POST",
      headers: { "x-user-role": "STAFF", "x-user-id": "test-user" },
      body: JSON.stringify({
        templateId: "tmpl_123",
        rows: [],
        // Missing customer name
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
