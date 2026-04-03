import type { PrismaClient } from "@prisma/client";

type PartyRelationClient = Pick<PrismaClient, "party" | "user">;

export async function findUniqueCustomerPartyIdForUser(
  prisma: PartyRelationClient,
  userId: string,
  tenantId: string
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
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
