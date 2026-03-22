import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import PartyProfileClient from "./PartyProfileClient";

export const dynamic = "force-dynamic";

export default async function PartyProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const party = await prisma.party.findUnique({ where: { id } });
  if (!party) return notFound();

  // Fetch payments
  const payments = await prisma.payment.findMany({
    where: { partyId: id },
    orderBy: { date: "asc" },
  });

  // Fetch bills (fuzzy match by phone or name)
  const bills = await prisma.bill.findMany({
    where: {
      OR: [
        ...(party.phone ? [{ customerPhone: party.phone }] : []),
        { customerName: party.name },
      ],
      status: "FINALIZED",
    },
    orderBy: { createdAt: "asc" },
  });

  // Fetch measurements (fuzzy match by user phone or email)
  let measurements: any[] = [];
  if (party.type === "CUSTOMER" && (party.phone || party.email)) {
    const matchingUser = await prisma.user.findFirst({
      where: {
        OR: [
          ...(party.phone ? [{ phone: party.phone }] : []),
          ...(party.email ? [{ email: party.email }] : []),
        ],
        role: "CUSTOMER",
      },
    });

    if (matchingUser) {
      measurements = await prisma.measurementUpload.findMany({
        where: { customerId: matchingUser.id },
        orderBy: { createdAt: "desc" },
      });
    }
  }

  // Build Ledger array
  type LedgerEntry = {
    id: string;
    date: Date;
    type: "BILL" | "PAYMENT" | "OPENING";
    description: string;
    debit: number; // Increases party balance (they owe us / we owe them less) -> usually Bill for Customer
    credit: number; // Decreases party balance (they paid us / we got advance) -> usually Payment from Customer
    balanceAfter: number;
    link?: string;
  };

  let runningBalance = party.openingBalance;

  const ledger: LedgerEntry[] = [
    {
      id: "opening",
      date: party.createdAt,
      type: "OPENING",
      description: "Opening Balance",
      debit: runningBalance > 0 ? runningBalance : 0,
      credit: runningBalance < 0 ? Math.abs(runningBalance) : 0,
      balanceAfter: runningBalance,
    },
  ];

  const allTx = [
    ...bills.map((b: any) => ({
      ...b,
      txDate: b.createdAt,
      isBill: true,
    })),
    ...payments.map((p: any) => ({
      ...p,
      txDate: p.date,
      isBill: false,
    })),
  ].sort((a, b) => a.txDate.getTime() - b.txDate.getTime());

  for (const tx of allTx) {
    if (tx.isBill) {
      const b = tx as any;
      const amount = b.grandTotal;
      if (party.type === "CUSTOMER") {
        runningBalance += amount;
        ledger.push({
          id: b.id,
          date: b.createdAt,
          type: "BILL",
          description: `Bill #${b.billNumber}`,
          debit: amount,
          credit: 0,
          balanceAfter: runningBalance,
          link: `/bills/${b.id}`,
        });
      } else {
        runningBalance -= amount; // Bill from vendor increases what we owe them (negative balance)
        ledger.push({
          id: b.id,
          date: b.createdAt,
          type: "BILL",
          description: `Purchase Bill #${b.billNumber}`,
          debit: 0,
          credit: amount,
          balanceAfter: runningBalance,
          link: `/bills/${b.id}`,
        });
      }
    } else {
      const p = tx as any;
      const amount = p.amount;
      if (party.type === "CUSTOMER") {
        runningBalance -= amount; // Customer payment reduces their debt
        ledger.push({
          id: p.id,
          date: p.date,
          type: "PAYMENT",
          description: `Payment Received (${p.mode})`,
          debit: 0,
          credit: amount,
          balanceAfter: runningBalance,
        });
      } else {
        runningBalance += amount; // Payment to vendor reduces our debt
        ledger.push({
          id: p.id,
          date: p.date,
          type: "PAYMENT",
          description: `Payment Sent (${p.mode})`,
          debit: amount,
          credit: 0,
          balanceAfter: runningBalance,
        });
      }
    }
  }

  // Final sanity check
  const calculatedCurrent = runningBalance;
  
  return (
    <PartyProfileClient
      party={party}
      ledger={ledger}
      measurements={measurements}
      calculatedCurrent={calculatedCurrent}
    />
  );
}
