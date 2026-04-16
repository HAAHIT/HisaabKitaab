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
  party: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  journalEntry: {
    create: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn((cb) => cb(prismaMock)),
  $executeRaw: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/accounting", () => ({
  getBillBalanceDelta: vi.fn().mockReturnValue({ currentBalance: { decrement: 0 } }),
}));

vi.mock("@/lib/journal", () => ({
  journalForSalesReturn: vi.fn().mockResolvedValue({}),
  journalForPurchaseReturn: vi.fn().mockResolvedValue({}),
}));

import { POST } from "./route";

describe("Credit/Debit Notes API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthorized roles", async () => {
    const req = new NextRequest("http://localhost/api/credit-notes", {
      method: "POST",
      headers: { "x-user-role": "CUSTOMER" },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("creates a credit note successfully", async () => {
    prismaMock.party.findUnique.mockResolvedValue({
      id: "party-1",
      name: "Customer 1",
      type: "CUSTOMER",
    });
    prismaMock.bill.count.mockResolvedValue(0);
    prismaMock.bill.create.mockResolvedValue({ id: "note-1" });
    prismaMock.journalEntry.create.mockResolvedValue({ id: "je-1" });
    prismaMock.party.update.mockResolvedValue({});

    const req = new NextRequest("http://localhost/api/credit-notes", {
      method: "POST",
      headers: {
        "x-user-role": "ADMIN",
        "x-user-id": "user-1",
        "x-tenant-id": "test-tenant",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        partyId: "party-1",
        grandTotal: 500,
        subtotal: 400,
        taxAmount: 100,
        noteType: "CREDIT_NOTE",
        reasonForIssuance: "Sales Return",
        originalInvoiceNo: "BILL-001",
        placeOfSupply: "27",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.note).toBeDefined();
  });

  it("rejects missing originalInvoiceRef", async () => {
     const req = new NextRequest("http://localhost/api/credit-notes", {
      method: "POST",
      headers: {
        "x-user-role": "ADMIN",
        "x-user-id": "user-1",
        "x-tenant-id": "test-tenant",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        partyId: "party-1",
        grandTotal: 500,
        noteType: "CREDIT_NOTE",
        reasonForIssuance: "Sales Return",
        originalInvoiceNo: "", // Pass empty string to trigger .min(1, "...")
        placeOfSupply: "27",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Original Invoice Reference");
  });
});
