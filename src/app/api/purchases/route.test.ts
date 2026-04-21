import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Mock session-server
vi.mock("@/lib/session-server", () => ({
  resolveVerifiedTenantId: vi.fn().mockResolvedValue("test-tenant"),
  resolveWriteTenant: vi.fn().mockResolvedValue({ tenantId: "test-tenant", userId: "user-1", role: "ADMIN" }),
}));

// Mock rate limiter
vi.mock("@/lib/api-rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
}));

const prismaMock = vi.hoisted(() => ({
  bill: {
    count: vi.fn(),
    create: vi.fn(),
  },
  billTemplate: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  party: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  tenant: {
    findUnique: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn((cb) => cb(prismaMock)),
  $executeRaw: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

// Mock accounting and journal to avoid complex deep logic tests here
vi.mock("@/lib/accounting", () => ({
  buildBillSnapshotFromParty: vi.fn().mockReturnValue({}),
  getPostedBillBalanceDelta: vi.fn().mockReturnValue({ currentBalance: { decrement: 0 } }),
}));

vi.mock("@/lib/journal", () => ({
  journalForPurchaseBill: vi.fn().mockResolvedValue({}),
}));

import { POST } from "./route";

describe("Purchases API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthorized roles", async () => {
    const req = new NextRequest("http://localhost/api/purchases", {
      method: "POST",
      headers: { "x-user-role": "CUSTOMER" },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("creates a purchase bill successfully", async () => {
    prismaMock.party.findFirst.mockResolvedValue({
      id: "vendor-1",
      name: "Vendor 1",
      type: "VENDOR",
    });
    prismaMock.tenant.findUnique.mockResolvedValue({
      settings: { billing: { prefix: "PUR", tax: 18 } },
    });
    prismaMock.billTemplate.findFirst.mockResolvedValue({ id: "tmpl-1" });
    prismaMock.bill.count.mockResolvedValue(0);
    prismaMock.bill.create.mockResolvedValue({ 
      id: "bill-1", 
      billNumber: "PUR-202604-001",
      subtotal: { toNumber: () => 1000 },
      grandTotal: { toNumber: () => 1180 },
      createdAt: new Date()
    });

    const req = new NextRequest("http://localhost/api/purchases", {
      method: "POST",
      headers: {
        "x-user-role": "ADMIN",
        "x-user-id": "user-1",
        "x-tenant-id": "test-tenant",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        partyId: "vendor-1",
        rows: [{ desc: "Items", qty: 1, price: 1000 }],
        grandTotal: 1180,
        subtotal: 1000,
        taxAmount: 180,
        taxPercent: 18,
        isInterState: false,
        placeOfSupply: "27",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.bill.billNumber).toContain("PUR");
  });

  it("rejects missing placeOfSupply", async () => {
     const req = new NextRequest("http://localhost/api/purchases", {
      method: "POST",
      headers: {
        "x-user-role": "ADMIN",
        "x-user-id": "user-1",
        "x-tenant-id": "test-tenant",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        partyId: "vendor-1",
        rows: [{ desc: "Items", qty: 1, price: 1000 }],
        grandTotal: 1180,
        status: "FINAL",
        // placeOfSupply missing
      }),
    });

    const res = await POST(req);
    const data = await res.json();
    if (res.status !== 400) {
      console.log("DEBUG: expected 400 but got", res.status, data);
    }
    expect(res.status).toBe(400);
    expect(data.error).toContain("Place of Supply");
  });
});
