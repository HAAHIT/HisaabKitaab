import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import PartyProfileClient from "./PartyProfileClient";

export const dynamic = "force-dynamic";

type LedgerEntry = {
  id: string;
  date: Date;
  type: "BILL" | "PAYMENT" | "OPENING";
  description: string;
  debit: number;
  credit: number;
  balanceAfter: number;
  link?: string;
};

export default async function PartyProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const party = await prisma.party.findFirst({
    where: {
      id,
      isDeleted: false,
    },
  });
  if (!party) {
    return notFound();
  }

  const [payments, bills, measurements] = await Promise.all([
    prisma.payment.findMany({
      where: {
        partyId: id,
        isDeleted: false,
        status: "COMPLETED",
      },
      orderBy: { date: "asc" },
    }),
    prisma.bill.findMany({
      where: {
        partyId: id,
        isDeleted: false,
        status: "FINAL",
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.measurementUpload.findMany({
      where: {
        partyId: id,
        isDeleted: false,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

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

  const allTransactions = [
    ...bills.map((bill) => ({
      id: bill.id,
      txDate: bill.createdAt,
      kind: "BILL" as const,
      bill,
    })),
    ...payments.map((payment) => ({
      id: payment.id,
      txDate: payment.date,
      kind: "PAYMENT" as const,
      payment,
    })),
  ].sort((left, right) => left.txDate.getTime() - right.txDate.getTime());

  for (const transaction of allTransactions) {
    if (transaction.kind === "BILL") {
      const amount = transaction.bill.grandTotal;

      if (party.type === "CUSTOMER") {
        runningBalance += amount;
        ledger.push({
          id: transaction.bill.id,
          date: transaction.bill.createdAt,
          type: "BILL",
          description: `Bill #${transaction.bill.billNumber}`,
          debit: amount,
          credit: 0,
          balanceAfter: runningBalance,
          link: `/bills/${transaction.bill.id}`,
        });
      } else {
        runningBalance -= amount;
        ledger.push({
          id: transaction.bill.id,
          date: transaction.bill.createdAt,
          type: "BILL",
          description: `Purchase Bill #${transaction.bill.billNumber}`,
          debit: 0,
          credit: amount,
          balanceAfter: runningBalance,
          link: `/bills/${transaction.bill.id}`,
        });
      }

      continue;
    }

    const amount = transaction.payment.amount;
    if (party.type === "CUSTOMER") {
      runningBalance -= amount;
      ledger.push({
        id: transaction.payment.id,
        date: transaction.payment.date,
        type: "PAYMENT",
        description: `Payment Received (${transaction.payment.mode})`,
        debit: 0,
        credit: amount,
        balanceAfter: runningBalance,
      });
    } else {
      runningBalance += amount;
      ledger.push({
        id: transaction.payment.id,
        date: transaction.payment.date,
        type: "PAYMENT",
        description: `Payment Sent (${transaction.payment.mode})`,
        debit: amount,
        credit: 0,
        balanceAfter: runningBalance,
      });
    }
  }

  return (
    <PartyProfileClient
      party={party}
      ledger={ledger}
      measurements={measurements}
      calculatedCurrent={runningBalance}
    />
  );
}
