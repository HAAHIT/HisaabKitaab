import { buildPartyLedger, asSupportedPartyType } from "@/lib/accounting";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import PartyProfileClient from "./PartyProfileClient";
import { resolveServerSession } from "@/lib/session-server";

export const dynamic = "force-dynamic";

export default async function PartyProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await resolveServerSession();
  if (!session) return notFound();
  const { tenantId, role } = session;

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

  const [payments, bills, allBills, measurements, journalLines] = await Promise.all([
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
    prisma.bill.findMany({
      where: {
        tenantId,
        partyId: id,
        isDeleted: false,
      },
      select: { id: true, billNumber: true, status: true, grandTotal: true, date: true, createdAt: true },
      orderBy: { date: "desc" },
    }),
    prisma.measurementUpload.findMany({
      where: {
        tenantId,
        partyId: id,
        isDeleted: false,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.journalLine.findMany({
      where: {
        partyId: id,
        journal: {
          tenantId,
          voucherType: { in: ["CREDIT_NOTE", "DEBIT_NOTE"] },
        },
      },
      include: {
        journal: true,
      },
      orderBy: {
        journal: { entryDate: "asc" },
      },
    }),
  ]);

  const notes = journalLines.map((line: { id: string; debit: any; credit: any; journal: { id: string; entryDate: Date; voucherType: string; narration: string | null } }) => ({
    id: line.journal.id,
    date: line.journal.entryDate,
    voucherType: line.journal.voucherType as "CREDIT_NOTE" | "DEBIT_NOTE",
    narration: line.journal.narration ?? "",  // PartyLedgerNote requires string, not string|null
    debit: Number(line.debit),
    credit: Number(line.credit),
  }));

  const { calculatedCurrent } = buildPartyLedger({
    partyType: asSupportedPartyType(party.type),
    openingBalance: party.openingBalance.toNumber(),
    createdAt: party.createdAt,
    bills: bills.map((b: { id: string; billNumber: string; grandTotal: any; date: Date }) => ({
      id: b.id,
      billNumber: b.billNumber,
      grandTotal: Number(b.grandTotal),
      date: b.date,
    })),
    payments: payments.map((p: { id: string; amount: any; direction: string; mode: string; date: Date }) => ({
      id: p.id,
      amount: Number(p.amount),
      direction: p.direction as "INCOMING" | "OUTGOING",  // Prisma returns string; narrow for SupportedPayDirection
      mode: p.mode,
      date: p.date
    })),
    notes,
  });

  return (
    <PartyProfileClient
      partyId={party.id}
      party={{
        name: party.name,
        type: party.type as "CUSTOMER" | "VENDOR",
        phone: party.phone,
        email: party.email,
        address: party.address,
        gstin: party.gstin,
        openingBalance: party.openingBalance.toNumber(),
        createdAt: party.createdAt,
      }}
      measurements={measurements}
      calculatedCurrent={calculatedCurrent}
      role={role}
      billsList={allBills.map((b) => ({
        id: b.id,
        billNumber: b.billNumber,
        status: b.status,
        grandTotal: Number(b.grandTotal),
        createdAt: b.createdAt,
      }))}
      paymentsList={payments.slice().reverse().slice(0, 10).map((p) => ({
        id: p.id,
        direction: p.direction,
        mode: p.mode,
        date: p.date,
        amount: Number(p.amount),
      }))}
    />
  );
}
