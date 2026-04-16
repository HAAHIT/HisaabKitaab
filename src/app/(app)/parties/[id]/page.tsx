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
    openingBalance: party.openingBalance.toNumber(),
    createdAt: party.createdAt,
    bills: bills.map((b) => ({ id: b.id, billNumber: b.billNumber, grandTotal: b.grandTotal.toNumber(), createdAt: b.createdAt })),
    payments: payments.map((p) => ({ id: p.id, amount: p.amount.toNumber(), direction: p.direction, mode: p.mode, date: p.date })),
  });

  return (
    <PartyProfileClient
      partyId={party.id}
      party={{ ...party, openingBalance: party.openingBalance.toNumber() }}
      ledger={ledger}
      measurements={measurements}
      calculatedCurrent={calculatedCurrent}
      role={role}
    />
  );
}
