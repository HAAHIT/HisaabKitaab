import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { findUniqueCustomerPartyIdForUser } from "./party-relations";

type PartyRelationClient = Pick<PrismaClient, "party" | "user">;

describe("findUniqueCustomerPartyIdForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes user lookup by tenantId", async () => {
    const userFindFirst = vi.fn().mockResolvedValue({
      phone: null,
      email: null,
    });
    const partyFindMany = vi.fn().mockResolvedValue([]);

    const prisma = {
      user: { findFirst: userFindFirst },
      party: { findMany: partyFindMany },
    } as unknown as PartyRelationClient;

    const result = await findUniqueCustomerPartyIdForUser(
      prisma,
      "user-1",
      "tenant-a"
    );

    expect(result).toBeNull();
    expect(userFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "user-1",
          tenantId: "tenant-a",
        }),
      })
    );
  });

  it("returns the matching party when exactly one phone match exists", async () => {
    const userFindFirst = vi.fn().mockResolvedValue({
      phone: "9999999999",
      email: "owner@example.com",
    });
    const partyFindMany = vi
      .fn()
      .mockResolvedValueOnce([{ id: "party-1" }]);

    const prisma = {
      user: { findFirst: userFindFirst },
      party: { findMany: partyFindMany },
    } as unknown as PartyRelationClient;

    const result = await findUniqueCustomerPartyIdForUser(
      prisma,
      "user-1",
      "tenant-a"
    );

    expect(result).toBe("party-1");
    expect(partyFindMany).toHaveBeenCalledTimes(1);
    expect(partyFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-a",
          type: "CUSTOMER",
          phone: "9999999999",
        }),
      })
    );
  });
});
