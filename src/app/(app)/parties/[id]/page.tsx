import { buildPartyLedger } from "@/lib/accounting";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import PartyProfileClient from "./PartyProfileClient";
import { headers } from "next/headers";
import { resolveTenantIdFromRequest } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * Render the party profile page for the party identified by `params.id`, scoped to the request's tenant.
 *
 * If the tenant cannot be resolved from the request or the party does not exist, this returns a 404 response.
 *
 * @param params - A promise that resolves to an object containing the route parameter `id` for the party
 * @returns A React element that renders the party profile client populated with party data, ledger, measurements, calculated current balance, and the requesting user's role; or a 404 response when tenant or party is missing.
 */
export default async function PartyProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const headerStore = await headers();
  const tenantId = resolveTenantIdFromRequest({ headers: headerStore });
  const role = headerStore.get("x-user-role");
  if (!tenantId) {
    return notFound();
  }

  const party = await prisma.party.findFirst({
    where: {
      id,
      tenantId,
      isDeleted: false,
    },
  });
  if (!party) {
    return notFound();
  }

  const [payments, bills, measurements] = await Promise.all([
    prisma.payment.findMany({
      where: {
        tenantId,
        partyId: id,
        isDeleted: false,
        status: "COMPLETED",
      },
      orderBy: { date: "asc" },
    }),
    prisma.bill.findMany({
      where: {
        tenantId,
        partyId: id,
        isDeleted: false,
        status: "FINAL",
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.measurementUpload.findMany({
      where: {
        tenantId,
        partyId: id,
        isDeleted: false,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const { ledger, calculatedCurrent } = buildPartyLedger({
    partyType: party.type,
    openingBalance: party.openingBalance,
    createdAt: party.createdAt,
    bills,
    payments,
  });

  return (
    <PartyProfileClient
      partyId={party.id}
      party={party}
      ledger={ledger}
      measurements={measurements}
      calculatedCurrent={calculatedCurrent}
      role={role}
    />
  );
}
