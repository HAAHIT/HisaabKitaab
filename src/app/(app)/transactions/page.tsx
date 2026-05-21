import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Prisma, VoucherType } from "@prisma/client";
import { tenantScope } from "@/lib/tenant";
import TransactionsClient from "./TransactionsClient";

export default async function TransactionsPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ from?: string; to?: string; type?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const session = await getSession();
  if (!session) redirect("/login");

  const where: Prisma.JournalEntryWhereInput = { ...(await tenantScope()), isDeleted: false };

  const entryDateFilter: Prisma.DateTimeFilter = {};
  if (searchParams.from) {
    const fromDate = new Date(searchParams.from);
    if (!isNaN(fromDate.getTime())) {
      entryDateFilter.gte = fromDate;
    }
  }

  if (searchParams.to) {
    const toDate = new Date(searchParams.to);
    if (!isNaN(toDate.getTime())) {
      entryDateFilter.lte = toDate;
    }
  }

  if (Object.keys(entryDateFilter).length > 0) {
    where.entryDate = entryDateFilter;
  }

  if (searchParams.type) {
    // Basic validation to ensure it's a valid enum member
    // Map 'BILL' (UI) to 'SALES' (Schema)
    let typeVal = searchParams.type;
    if (typeVal === "BILL") typeVal = "SALES";

    const allowed = ["SALES", "PURCHASE", "PAYMENT", "RECEIPT", "CREDIT_NOTE", "DEBIT_NOTE", "JOURNAL"];
    if (allowed.includes(typeVal)) {
      where.voucherType = typeVal as VoucherType;
    }
  }

  const transactions = await prisma.journalEntry.findMany({
    where,
    include: {
      lines: true,
    },
    orderBy: {
      entryDate: "desc",
    },
    take: 200,
  });

  // Serialize Decimal objects for Client Component
  const serializedTransactions = JSON.parse(JSON.stringify(transactions));

  return <TransactionsClient initialTransactions={serializedTransactions} />;
}


