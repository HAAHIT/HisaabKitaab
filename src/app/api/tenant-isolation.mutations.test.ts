import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const prismaMock = vi.hoisted(() => ({
  billTemplate: {
    findFirst: vi.fn(),
  },
  party: {
    findFirst: vi.fn(),
  },
  tenant: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  user: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/session-server", () => ({
  resolveVerifiedTenantId: vi.fn(async (request: NextRequest) => {
    const tenantId = request.headers.get("x-tenant-id");
    return tenantId && tenantId.trim() ? tenantId.trim() : null;
  }),
}));

// All these routes import `resolveSession` from `@/lib/api-tenant`. Derive the
// session from the test request headers so existing test inputs keep working.
vi.mock("@/lib/api-tenant", () => ({
  resolveSession: vi.fn(async (request: NextRequest) => {
    const role = request.headers.get("x-user-role");
    const tenantId = request.headers.get("x-tenant-id");
    const userId = request.headers.get("x-user-id") ?? "test-user";
    if (!role || !tenantId) {
      return {
        ok: false,
        response: new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      };
    }
    return {
      ok: true,
      session: { tenantId, userId, role },
    };
  }),
  resolveReadTenant: vi.fn(async (request: NextRequest) => {
    const tenantId = request.headers.get("x-tenant-id");
    if (!tenantId) {
      return {
        ok: false,
        response: new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      };
    }
    return { ok: true, tenantId };
  }),
  resolveWriteTenant: vi.fn(async (request: NextRequest) => {
    const tenantId = request.headers.get("x-tenant-id");
    if (!tenantId) {
      return {
        ok: false,
        response: new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      };
    }
    return { ok: true, tenantId };
  }),
}));

import { POST as postBill } from "./bills/route";
import { POST as postPayment } from "./payments/route";
import { PATCH as patchParty } from "./parties/[id]/route";
import { PATCH as patchSettings } from "./settings/route";
import { PATCH as patchUser } from "./users/[id]/route";

import { createMockBill } from "@/lib/testing/fixtures";

function buildRequest(
  url: string,
  method: "POST" | "PATCH",
  headers: Record<string, string>,
  body: unknown
) {
  return new NextRequest(url, {
    method,
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("tenant isolation for critical mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes bill creation template lookup by tenant", async () => {
    prismaMock.billTemplate.findFirst.mockResolvedValue(null);

    const request = buildRequest(
      "http://localhost/api/bills",
      "POST",
      {
        "x-user-role": "ADMIN",
        "x-user-id": "admin-1",
        "x-tenant-id": "tenant-a",
      },
      {
        templateId: "tmpl-shared",
        partyId: "party-1",
        customerName: "Valid Customer",
        rows: [{ item: "Item", qty: 1 }],
      }
    );

    const response = await postBill(request);
    expect(response.status).toBe(404);
    const payload = await response.json();
    expect(payload.error).toBe("Template not found");

    expect(prismaMock.billTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "tmpl-shared",
          tenantId: "tenant-a",
          isDeleted: false,
        }),
      })
    );
  });

  it("rejects payment creation when linked bill belongs to a different tenant", async () => {
    const txMock = {
      bill: {
        findUnique: vi.fn().mockResolvedValue(createMockBill({
          tenantId: "tenant-b",
        })),
      },
      party: {
        findFirst: vi.fn(),
      },
      $executeRaw: vi.fn(),
      payment: {
        findUnique: vi.fn(),
      },
    };

    prismaMock.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb(txMock)
    );

    const request = buildRequest(
      "http://localhost/api/payments",
      "POST",
      {
        "x-user-role": "ADMIN",
        "x-user-id": "admin-1",
        "x-tenant-id": "tenant-a",
      },
      {
        billId: "bill-1",
        amount: 1000,
        type: "INCOMING",
        mode: "CASH",
        accountId: "account-1",
      }
    );

    const response = await postPayment(request);
    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error).toContain("Linked bill must be a final bill");

    expect(txMock.bill.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "bill-1" },
        select: expect.objectContaining({
          tenantId: true,
        }),
      })
    );
  });

  it("scopes party update visibility by tenant", async () => {
    prismaMock.party.findFirst.mockResolvedValue(null);

    const request = buildRequest(
      "http://localhost/api/parties/party-1",
      "PATCH",
      {
        "x-user-role": "ADMIN",
        "x-tenant-id": "tenant-a",
      },
      {
        name: "Updated Party",
        type: "CUSTOMER",
      }
    );

    const response = await patchParty(request, {
      params: Promise.resolve({ id: "party-1" }),
    });

    expect(response.status).toBe(404);
    expect(prismaMock.party.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "party-1",
          tenantId: "tenant-a",
          isDeleted: false,
        }),
      })
    );
  });

  it("scopes settings patch by tenant lookup", async () => {
    prismaMock.tenant.findUnique.mockResolvedValue(null);

    const request = buildRequest(
      "http://localhost/api/settings",
      "PATCH",
      {
        "x-user-role": "ADMIN",
        "x-tenant-id": "tenant-a",
      },
      {
        companyName: "SoloBooks",
        companyAddress: "",
        companyPhone: "",
        companyEmail: "",
        companyGstin: "",
        defaultTaxPercent: 18,
        defaultTerms: "",
        billPrefix: "BILL",
      }
    );

    const response = await patchSettings(request);
    expect(response.status).toBe(404);
    const payload = await response.json();
    expect(payload.error).toBe("Tenant not found");
    expect(prismaMock.tenant.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tenant-a" },
      })
    );
  });

  it("scopes user update existence check by tenant", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);

    const request = buildRequest(
      "http://localhost/api/users/user-1",
      "PATCH",
      {
        "x-user-role": "ADMIN",
        "x-tenant-id": "tenant-a",
      },
      {
        name: "Updated User",
      }
    );

    const response = await patchUser(request, {
      params: Promise.resolve({ id: "user-1" }),
    });

    expect(response.status).toBe(404);
    const payload = await response.json();
    expect(payload.error).toBe("User not found");

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "user-1",
          tenantId: "tenant-a",
        }),
      })
    );
  });
});
