import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const prismaMock = vi.hoisted(() => ({
  billTemplate: {
    findFirst: vi.fn(),
  },
  party: {
    findFirst: vi.fn(),
  },
  user: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { POST as postBill } from "./bills/route";
import { POST as postPayment } from "./payments/route";
import { PATCH as patchParty } from "./parties/[id]/route";
import { PATCH as patchSettings } from "./settings/route";
import { PATCH as patchUser } from "./users/[id]/route";

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
        findUnique: vi.fn().mockResolvedValue({
          id: "bill-1",
          tenantId: "tenant-b",
          partyId: "party-1",
          status: "FINAL",
          party: { id: "party-1", type: "CUSTOMER" },
        }),
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

  it("scopes settings patch by tenant in raw lookup", async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);

    const request = buildRequest(
      "http://localhost/api/settings",
      "PATCH",
      {
        "x-user-role": "ADMIN",
        "x-tenant-id": "tenant-a",
      },
      {
        companyName: "HisaabKitaab",
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

    const firstCall = prismaMock.$queryRaw.mock.calls[0] || [];
    expect(firstCall[1]).toBe("tenant-a");
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
