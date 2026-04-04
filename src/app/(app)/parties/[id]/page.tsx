import { buildPartyLedger } from "@/lib/accounting";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import PartyProfileClient from "./PartyProfileClient";
import { headers } from "next/headers";
import { resolveTenantIdFromRequest } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function PartyProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenantId = resolveTenantIdFromRequest({ headers: await headers() });
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
    />
  );
}
