import { prisma } from "../src/lib/prisma";
import {
  journalForPaymentMade,
  journalForPaymentReceived,
  journalForSalesBill,
} from "../src/lib/journal";

/**
 * Backfills journal entries for existing sales bills and payments and logs a summary.
 *
 * Scans finalized, non-deleted bills and completed incoming/outgoing payments and creates missing
 * journal entries: `SALES` for bills with an associated party, `RECEIPT` for incoming payments,
 * and `PAYMENT` for outgoing payments. Tracks counts of created entries and bills skipped due to
 * missing party information, then prints a JSON summary containing `billCreated`, `receiptCreated`,
 * `paymentCreated`, and `skipped`.
 */
async function main() {
  const [bills, incomingPayments, outgoingPayments] = await Promise.all([
    prisma.bill.findMany({
      where: {
        isDeleted: false,
        status: "FINAL",
      },
      include: {
        party: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.payment.findMany({
      where: {
        isDeleted: false,
        status: "COMPLETED",
        direction: "INCOMING",
      },
      include: {
        party: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { date: "asc" },
    }),
    prisma.payment.findMany({
      where: {
        isDeleted: false,
        status: "COMPLETED",
        direction: "OUTGOING",
      },
      include: {
        party: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { date: "asc" },
    }),
  ]);

  let billCreated = 0;
  let receiptCreated = 0;
  let paymentCreated = 0;
  let skipped = 0;

  for (const bill of bills) {
    if (!bill.partyId || !bill.party) {
      skipped += 1;
      continue;
    }

    const existingSalesEntry = await prisma.journalEntry.findFirst({
      where: {
        billId: bill.id,
        voucherType: "SALES",
      },
      select: { id: true },
    });

    if (existingSalesEntry) {
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await journalForSalesBill(tx, bill.tenantId, {
        id: bill.id,
        billNumber: bill.billNumber,
        partyId: bill.partyId!,
        partyName: bill.party?.name || bill.customerName,
        subtotal: bill.subtotal,
        taxAmount: bill.taxAmount,
        grandTotal: bill.grandTotal,
        createdBy: bill.createdBy,
        entryDate: bill.createdAt,
      });
    });

    billCreated += 1;
  }

  for (const payment of incomingPayments) {
    const existingReceiptEntry = await prisma.journalEntry.findFirst({
      where: {
        paymentId: payment.id,
        voucherType: "RECEIPT",
      },
      select: { id: true },
    });

    if (existingReceiptEntry) {
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await journalForPaymentReceived(tx, payment.tenantId, {
        id: payment.id,
        partyId: payment.partyId,
        partyName: payment.party.name,
        amount: payment.amount,
        mode: payment.mode,
        date: payment.date,
        createdBy: payment.createdBy,
      });
    });

    receiptCreated += 1;
  }

  for (const payment of outgoingPayments) {
    const existingPaymentEntry = await prisma.journalEntry.findFirst({
      where: {
        paymentId: payment.id,
        voucherType: "PAYMENT",
      },
      select: { id: true },
    });

    if (existingPaymentEntry) {
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await journalForPaymentMade(tx, payment.tenantId, {
        id: payment.id,
        partyId: payment.partyId,
        partyName: payment.party.name,
        amount: payment.amount,
        mode: payment.mode,
        date: payment.date,
        createdBy: payment.createdBy,
      });
    });

    paymentCreated += 1;
  }

  console.log(
    JSON.stringify(
      {
        billCreated,
        receiptCreated,
        paymentCreated,
        skipped,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
