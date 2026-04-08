import type { PrismaClient } from "@prisma/client";

type PartyRelationClient = Pick<PrismaClient, "party" | "user">;

/**
 * Find a unique active CUSTOMER party id for a user within a tenant by matching the user's phone or email.
 *
 * Looks up the user (scoped to `tenantId`) and first attempts to find exactly one active, non-deleted CUSTOMER party with the same phone; if that yields exactly one match its `id` is returned. If not, the function attempts the same match by email. Returns `null` if the user is not found or neither field produces exactly one match.
 *
 * @param userId - ID of the user to look up
 * @param tenantId - Tenant id used to scope the user lookup and party matches
 * @returns The matching party `id` if exactly one CUSTOMER match is found, `null` otherwise
 */
export async function findUniqueCustomerPartyIdForUser(
  prisma: PartyRelationClient,
  userId: string,
  tenantId: string
) {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      tenantId,
    },
    select: { phone: true, email: true },
  });

  if (!user) {
    return null;
  }

  if (user.phone) {
    const phoneMatches = await prisma.party.findMany({
      where: {
        tenantId,
        type: "CUSTOMER",
        isActive: true,
        isDeleted: false,
        phone: user.phone,
      },
      select: { id: true },
      take: 2,
    });

    if (phoneMatches.length === 1) {
      return phoneMatches[0].id;
    }
  }

  if (user.email) {
    const emailMatches = await prisma.party.findMany({
      where: {
        tenantId,
        type: "CUSTOMER",
        isActive: true,
        isDeleted: false,
        email: user.email,
      },
      select: { id: true },
      take: 2,
    });

    if (emailMatches.length === 1) {
      return emailMatches[0].id;
    }
  }

  return null;
}
