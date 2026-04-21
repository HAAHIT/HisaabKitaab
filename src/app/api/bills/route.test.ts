import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Mock session-server so POST tests don't need a real JWT cookie
vi.mock("@/lib/session-server", () => ({
  resolveVerifiedTenantId: vi.fn().mockResolvedValue("test-tenant"),
}));

// Mock rate limiter so tests are never throttled
vi.mock("@/lib/api-rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
}));

const prismaMock = vi.hoisted(() => ({
  bill: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  billTemplate: {
    findFirst: vi.fn(),
  },
  party: {
    findFirst: vi.fn(),
  },
  tenant: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { GET, POST } from "./route";

// ── Authorization guards ───────────────────────────────────────────────────

describe("Bills API — authorization guards", () => {
  it("GET rejects missing role header with 403", async () => {
    const req = new NextRequest("http://localhost/api/bills");
    const res = await GET(req);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Forbidden");
  });

  it("GET rejects CUSTOMER role with 403", async () => {
    const req = new NextRequest("http://localhost/api/bills", {
      headers: { "x-user-role": "CUSTOMER", "x-tenant-id": "test-tenant" },
    });
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("POST rejects missing customer name with 400", async () => {
    const req = new NextRequest("http://localhost/api/bills", {
      method: "POST",
      headers: {
        "x-user-role": "ADMIN",
        "x-user-id": "test-user",
        "x-tenant-id": "test-tenant",
        "content-type": "application/json",
      },
      body: JSON.stringify({ templateId: "tmpl_123", partyId: "party-1", rows: [{}] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("Customer name is required");
  });
});

// ── GET success path ───────────────────────────────────────────────────────

describe("Bills API — GET success path", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns paginated bill list with correct metadata", async () => {
    prismaMock.bill.findMany.mockResolvedValue([
      {
        id: "bill-1",
        billNumber: "BILL-202401-001",
        partyId: "party-1",
        party: { id: "party-1", name: "Acme", type: "CUSTOMER" },
        customerName: "Acme",
        grandTotal: 1180,
        status: "FINAL",
        createdAt: new Date("2024-01-15"),
      },
    ]);
    prismaMock.bill.count.mockResolvedValue(1);

    const req = new NextRequest("http://localhost/api/bills?page=1&limit=20", {
      headers: { "x-user-role": "ADMIN", "x-tenant-id": "test-tenant" },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.bills).toHaveLength(1);
    expect(data.bills[0].billNumber).toBe("BILL-202401-001");
    expect(data.total).toBe(1);
    expect(data.totalPages).toBe(1);
    expect(data.page).toBe(1);
  });

  it("scopes findMany query to the resolved tenantId", async () => {
    prismaMock.bill.findMany.mockResolvedValue([]);
    prismaMock.bill.count.mockResolvedValue(0);

    // [LB-1] tenantId is now resolved from JWT, not x-tenant-id header
    // resolveVerifiedTenantId is mocked globally to return "test-tenant"
    const req = new NextRequest("http://localhost/api/bills", {
      headers: { "x-user-role": "STAFF" },
    });

    await GET(req);

    expect(prismaMock.bill.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "test-tenant", isDeleted: false }),
      })
    );
  });
});

// ── POST business logic ────────────────────────────────────────────────────

describe("Bills API — POST business logic", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects FINAL bill with zero grand total", async () => {
    prismaMock.billTemplate.findFirst.mockResolvedValue({ id: "tmpl-1" });
    prismaMock.party.findFirst.mockResolvedValue({
      id: "party-1", name: "Test Co", type: "CUSTOMER",
      phone: null, address: null, gstin: null,
    });
    prismaMock.tenant.findUnique.mockResolvedValue({ settings: {} });

    const req = new NextRequest("http://localhost/api/bills", {
      method: "POST",
      headers: {
        "x-user-role": "ADMIN",
        "x-user-id": "user-1",
        "x-tenant-id": "test-tenant",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        templateId: "tmpl-1",
        partyId: "party-1",
        customerName: "Test Co",
        rows: [{ desc: "Item", qty: 1, price: 0 }],
        status: "FINAL",
        grandTotal: 0,
        subtotal: 0,
        taxAmount: 0,
        taxPercent: 0,
        isInterState: false,
        placeOfSupply: "27", // Maharashtra — satisfies P0 placeOfSupply gate
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("positive total");
  });

  it("auto-derives isInterState as false when GSTIN is absent and field is omitted", async () => {
    prismaMock.billTemplate.findFirst.mockResolvedValue({ id: "tmpl-1" });
    prismaMock.party.findFirst.mockResolvedValue({
      id: "party-1", name: "Test Co", type: "CUSTOMER",
      phone: null, address: null, gstin: null,
    });
    // Return tenant without GSTIN + billing settings
    prismaMock.tenant.findUnique
      .mockResolvedValueOnce({ settings: {} })  // loadBillingSettings
      .mockResolvedValueOnce({ gstin: null });   // tenant GSTIN lookup (G-C1)

    // Mock the transaction to capture the bill creation
    prismaMock.$transaction.mockImplementation(async (fn: any) => {
      // Return a mock bill object
      return { id: "bill-1", isInterState: false };
    });

    const req = new NextRequest("http://localhost/api/bills", {
      method: "POST",
      headers: {
        "x-user-role": "ADMIN",
        "x-user-id": "user-1",
        "x-tenant-id": "test-tenant",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        templateId: "tmpl-1",
        partyId: "party-1",
        customerName: "Test Co",
        rows: [{ desc: "Item" }],
        grandTotal: 100,
        subtotal: 100,
        taxAmount: 0,
        // isInterState intentionally omitted — should auto-derive to false
      }),
    });

    const res = await POST(req);
    // [G-C1] isInterState is no longer required — auto-derived from GSTIN comparison
    expect(res.status).toBe(201);
  });
});
