import { prisma } from "@/lib/prisma";
import {
  CHART_OF_ACCOUNTS,
  paymentModeToAccount,
  type AccountCode,
} from "@/lib/chart-of-accounts";
import { roundTo2 } from "@/lib/journal-reporting";

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type VoucherType = "SALES" | "PURCHASE" | "RECEIPT" | "PAYMENT" | "JOURNAL" | "CREDIT_NOTE" | "DEBIT_NOTE" | "CONTRA";

interface JournalLineInput {
  accountCode: AccountCode;
  debit: number;
  credit: number;
  partyId?: string | null;
  partyName?: string | null;
}

interface JournalEntryParams {
  tenantId: string;
  entryDate: Date;
  narration: string;
  voucherType: VoucherType;
  billId?: string;
  purchaseId?: string;
  paymentId?: string;
  isReverseCharge?: boolean;
  /**
   * Tally REMOTEID (with "HisaabKitaab-" prefix already stripped).
   * Stored in JournalEntry.remoteId for idempotent Tally re-imports.
   * Null / undefined for natively-created entries.
   */
  remoteId?: string | null;
  createdBy: string;
  lines: JournalLineInput[];
}

interface SalesBillJournalInput {
  id: string;
  billNumber: string;
  partyId: string;
  partyName: string;
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  roundOff?: number; // Explicit round-off amount from bill UI
  createdBy: string;
  entryDate: Date;
  isInterState?: boolean;
}

interface PaymentJournalInput {
  id: string;
  partyId: string;
  partyName: string;
  amount: number;
  mode: string;
  date: Date;
  createdBy: string;
}

interface PurchaseBillJournalInput {
  id: string;
  vendorName: string;
  partyId: string | null;
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  grandTotal: number;
  isReverseCharge?: boolean;
  createdBy: string;
  billDate: Date;
}

function buildSalesTaxLines(
  taxAmount: number,
  direction: "DEBIT" | "CREDIT",
  isInterState = false
) {
  if (taxAmount <= 0) {
    return [];
  }

  if (isInterState) {
    const roundedIgst = Math.round(taxAmount);
    return [
      {
        accountCode: "IGST_OUTPUT" as const,
        debit: direction === "DEBIT" ? roundedIgst : 0,
        credit: direction === "CREDIT" ? roundedIgst : 0,
      },
    ];
  }

  // [Section 170 CGST Act] GST amounts must be rounded to the "Nearest Rupee"
  const roundedTax = Math.round(taxAmount);
  const halfTax = Math.round(roundedTax / 2);
  const otherHalf = roundedTax - halfTax;

  return [
    {
      accountCode: "CGST_OUTPUT" as const,
      debit: direction === "DEBIT" ? halfTax : 0,
      credit: direction === "CREDIT" ? halfTax : 0,
    },
    {
      accountCode: "SGST_OUTPUT" as const,
      debit: direction === "DEBIT" ? otherHalf : 0,
      credit: direction === "CREDIT" ? otherHalf : 0,
    },
  ];
}

export async function createJournalEntry(
  tx: PrismaTx,
  params: JournalEntryParams
) {
  const totalDebit = roundTo2(params.lines.reduce((sum, line) => sum + line.debit, 0));
  const totalCredit = roundTo2(
    params.lines.reduce((sum, line) => sum + line.credit, 0)
  );

  // [FIX-P1] Tolerance reduced from 0.01 → 0.001 now that JournalLine.debit/credit
  // are stored as Decimal(19,4). Any residual above 0.001 is a real accounting error,
  // not IEEE-754 float drift.
  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    throw new Error(
      `UNBALANCED JOURNAL ENTRY: Debit (${totalDebit}) != Credit (${totalCredit}). ` +
      `Narration: "${params.narration}".`
    );
  }

  for (const line of params.lines) {
    if (line.debit > 0 && line.credit > 0) {
      throw new Error(
        `Journal line cannot have both debit and credit. Account: ${line.accountCode}`
      );
    }

    if (roundTo2(line.debit) === 0 && roundTo2(line.credit) === 0) {
      throw new Error(
        `Journal line must have either a debit or a credit. Account: ${line.accountCode}`
      );
    }
  }

  return tx.journalEntry.create({
    data: {
      tenantId: params.tenantId,
      entryDate: params.entryDate,
      narration: params.narration,
      voucherType: params.voucherType,
      billId: params.billId,
      purchaseId: params.purchaseId,
      paymentId: params.paymentId,
      isReverseCharge: params.isReverseCharge || false,
      remoteId: params.remoteId ?? null,
      createdBy: params.createdBy,
      totalDebit,
      totalCredit,
      isBalanced: true,
      lines: {
        create: params.lines.map((line) => {
          const account = CHART_OF_ACCOUNTS[line.accountCode];

          return {
            accountCode: line.accountCode,
            accountName: account.name,
            tallyGroup: account.tallyGroup,
            partyId: line.partyId || null,
            partyName: line.partyName || null,
            debit: roundTo2(line.debit),
            credit: roundTo2(line.credit),
          };
        }),
      },
    },
    include: {
      lines: true,
    },
  });
}

export async function journalForSalesBill(
  tx: PrismaTx,
  tenantId: string,
  bill: SalesBillJournalInput
) {
  // buildSalesTaxLines rounds taxAmount to nearest rupee (Section 170 CGST Act).
  // diff must use the same rounded value so ROUND_OFF exactly balances the entry.
  const roundedTax = bill.taxAmount > 0 ? Math.round(bill.taxAmount) : 0;
  const creditSideBeforeRoundOff = roundTo2(bill.subtotal + roundedTax);
  const diff = roundTo2(bill.grandTotal - creditSideBeforeRoundOff);

  return createJournalEntry(tx, {
    tenantId,
    entryDate: bill.entryDate,
    narration: `Sales Bill ${bill.billNumber} to ${bill.partyName}`,
    voucherType: "SALES",
    billId: bill.id,
    createdBy: bill.createdBy,
    lines: [
      {
        accountCode: "SUNDRY_DEBTORS",
        debit: bill.grandTotal,
        credit: 0,
        partyId: bill.partyId,
        partyName: bill.partyName,
      },
      {
        accountCode: "SALES",
        debit: 0,
        credit: bill.subtotal,
      },
      ...buildSalesTaxLines(bill.taxAmount, "CREDIT", bill.isInterState),
      ...(diff !== 0
        ? [
          {
            accountCode: "ROUND_OFF" as const,
            debit: diff < 0 ? Math.abs(diff) : 0,
            credit: diff > 0 ? diff : 0,
          },
        ]
        : []),
    ],
  });
}

export async function journalForCancelledSalesBill(
  tx: PrismaTx,
  tenantId: string,
  bill: SalesBillJournalInput
) {
  const roundedTax = bill.taxAmount > 0 ? Math.round(bill.taxAmount) : 0;
  const creditSideBeforeRoundOff = roundTo2(bill.subtotal + roundedTax);
  const diff = roundTo2(bill.grandTotal - creditSideBeforeRoundOff);

  return createJournalEntry(tx, {
    tenantId,
    entryDate: bill.entryDate,
    narration: `Reversal of Sales Bill ${bill.billNumber} for ${bill.partyName}`,
    // CREDIT_NOTE is the correct GST voucher type for a sales bill cancellation.
    // Tally XML export maps this directly to "Sales Return" (GSTR-1 Table 9B).
    voucherType: "CREDIT_NOTE",
    billId: bill.id,
    createdBy: bill.createdBy,
    lines: [
      {
        accountCode: "SUNDRY_DEBTORS",
        debit: 0,
        credit: bill.grandTotal,
        partyId: bill.partyId,
        partyName: bill.partyName,
      },
      {
        accountCode: "SALES",
        debit: bill.subtotal,
        credit: 0,
      },
      ...buildSalesTaxLines(bill.taxAmount, "DEBIT", bill.isInterState),
      ...(diff !== 0
        ? [
          {
            accountCode: "ROUND_OFF" as const,
            debit: diff > 0 ? diff : 0,
            credit: diff < 0 ? Math.abs(diff) : 0,
          },
        ]
        : []),
    ],
  });
}

export async function journalForPaymentReceived(
  tx: PrismaTx,
  tenantId: string,
  payment: PaymentJournalInput
) {
  return createJournalEntry(tx, {
    tenantId,
    entryDate: payment.date,
    narration: `Payment received from ${payment.partyName} (${payment.mode})`,
    voucherType: "RECEIPT",
    paymentId: payment.id,
    createdBy: payment.createdBy,
    lines: [
      {
        accountCode: paymentModeToAccount(payment.mode),
        debit: payment.amount,
        credit: 0,
      },
      {
        accountCode: "SUNDRY_DEBTORS",
        debit: 0,
        credit: payment.amount,
        partyId: payment.partyId,
        partyName: payment.partyName,
      },
    ],
  });
}

export async function journalForPaymentMade(
  tx: PrismaTx,
  tenantId: string,
  payment: PaymentJournalInput
) {
  return createJournalEntry(tx, {
    tenantId,
    entryDate: payment.date,
    narration: `Payment to ${payment.partyName} (${payment.mode})`,
    voucherType: "PAYMENT",
    paymentId: payment.id,
    createdBy: payment.createdBy,
    lines: [
      {
        accountCode: "SUNDRY_CREDITORS",
        debit: payment.amount,
        credit: 0,
        partyId: payment.partyId,
        partyName: payment.partyName,
      },
      {
        accountCode: paymentModeToAccount(payment.mode),
        debit: 0,
        credit: payment.amount,
      },
    ],
  });
}

export async function journalForPurchaseBill(
  tx: PrismaTx,
  tenantId: string,
  purchase: PurchaseBillJournalInput
) {
  const theoreticalTotal = roundTo2(purchase.subtotal + purchase.cgst + purchase.sgst + purchase.igst);
  const diff = roundTo2(purchase.grandTotal - theoreticalTotal);

  const lines: JournalLineInput[] = [
    {
      accountCode: "PURCHASE",
      debit: purchase.subtotal,
      credit: 0,
    },
    {
      accountCode: "SUNDRY_CREDITORS",
      debit: 0,
      credit: purchase.grandTotal,
      partyId: purchase.partyId,
      partyName: purchase.vendorName,
    },
  ];

  if (purchase.cgst > 0) {
    lines.push({
      accountCode: "CGST_INPUT",
      debit: purchase.cgst,
      credit: 0,
    });
  }

  if (purchase.sgst > 0) {
    lines.push({
      accountCode: "SGST_INPUT",
      debit: purchase.sgst,
      credit: 0,
    });
  }

  if (purchase.igst > 0) {
    lines.push({
      accountCode: "IGST_INPUT",
      debit: purchase.igst,
      credit: 0,
    });
  }

  if (diff !== 0) {
    lines.push({
      accountCode: "ROUND_OFF",
      debit: diff > 0 ? diff : 0,
      credit: diff < 0 ? Math.abs(diff) : 0,
    });
  }

  return createJournalEntry(tx, {
    tenantId,
    entryDate: purchase.billDate,
    narration: `Purchase from ${purchase.vendorName}`,
    voucherType: "PURCHASE",
    purchaseId: purchase.id,
    isReverseCharge: purchase.isReverseCharge,
    createdBy: purchase.createdBy,
    lines,
  });
}
