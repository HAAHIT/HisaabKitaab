import { Prisma } from "@prisma/client";
import {
  CHART_OF_ACCOUNTS,
  paymentModeToAccount,
  type AccountCode,
} from "@/lib/chart-of-accounts";
import { roundTo2 } from "@/lib/journal-reporting";

type PrismaTx = Prisma.TransactionClient;
type VoucherType = "SALES" | "PURCHASE" | "RECEIPT" | "PAYMENT" | "JOURNAL";

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
  createdBy: string;
  billDate: Date;
}

/**
 * Builds tax journal lines for a sales transaction.
 *
 * @param taxAmount - Total tax amount to allocate across tax accounts
 * @param direction - Whether the tax amount should be recorded as a `DEBIT` or `CREDIT`
 * @param isInterState - When `true`, produce a single `IGST_OUTPUT` line; when `false`, split the amount between `CGST_OUTPUT` and `SGST_OUTPUT` (rounded to 2 decimals)
 * @returns An array of journal line objects each containing `accountCode`, `debit`, and `credit`. Returns an empty array when `taxAmount` is less than or equal to 0.
 */
function buildSalesTaxLines(
  taxAmount: number,
  direction: "DEBIT" | "CREDIT",
  isInterState = false
) {
  if (taxAmount <= 0) {
    return [];
  }

  if (isInterState) {
    return [
      {
        accountCode: "IGST_OUTPUT" as const,
        debit: direction === "DEBIT" ? taxAmount : 0,
        credit: direction === "CREDIT" ? taxAmount : 0,
      },
    ];
  }

  const halfTax = roundTo2(taxAmount / 2);
  const otherHalf = roundTo2(taxAmount - halfTax);

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

/**
 * Create and persist a balanced journal entry with its lines.
 *
 * @param params - Header and line data for the journal entry
 * @returns The newly created journal entry including its lines
 * @throws Error - If total debits and credits differ by more than 0.01 (entry unbalanced)
 * @throws Error - If any line has both debit and credit greater than 0
 * @throws Error - If any line has both debit and credit equal to 0 after rounding
 */
export async function createJournalEntry(
  tx: PrismaTx,
  params: JournalEntryParams
) {
  const totalDebit = roundTo2(params.lines.reduce((sum, line) => sum + line.debit, 0));
  const totalCredit = roundTo2(
    params.lines.reduce((sum, line) => sum + line.credit, 0)
  );

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
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

/**
 * Create a sales voucher journal entry for the given sales bill.
 *
 * @param tenantId - Identifier of the tenant for whom the entry is created
 * @param bill - Sales bill data used to construct journal lines (party info, totals, tax, and entry date)
 * @returns The created journal entry record including its journal lines
 */
export async function journalForSalesBill(
  tx: PrismaTx,
  tenantId: string,
  bill: SalesBillJournalInput
) {
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
    ],
  });
}

/**
 * Create a reversing journal entry for a cancelled sales bill.
 *
 * @param tx - Prisma transaction client used to persist the journal entry
 * @param tenantId - Tenant identifier for the journal entry
 * @param bill - Sales bill data used to construct reversal lines (includes id, billNumber, party info, subtotal, taxAmount, grandTotal, isInterState, createdBy, and entryDate)
 * @returns The created journal entry record including its lines
 */
export async function journalForCancelledSalesBill(
  tx: PrismaTx,
  tenantId: string,
  bill: SalesBillJournalInput
) {
  return createJournalEntry(tx, {
    tenantId,
    entryDate: bill.entryDate,
    narration: `Reversal of Sales Bill ${bill.billNumber} for ${bill.partyName}`,
    voucherType: "JOURNAL",
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
    ],
  });
}

/**
 * Create a receipt journal entry for a received payment.
 *
 * @param payment - Payment details used to build the journal entry. Must include `id`, `date`, `amount`, `mode`, `partyId`/`partyName` (optional), and `createdBy`.
 * @returns The created journal entry record including its persisted lines
 */
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

/**
 * Create and persist a payment voucher journal entry for an outgoing payment within the given transaction.
 *
 * @param payment - Payment data used to build the entry (must include `id`, `date`, `amount`, `mode`, `partyId`/`partyName`, and `createdBy`)
 * @returns The created journal entry record including its persisted journal lines
 */
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

/**
 * Create a purchase voucher journal entry for the given purchase bill.
 *
 * Builds journal lines for the purchase (subtotal), the creditor (grand total with party info),
 * and any applicable purchase tax input lines (CGST/SGST/IGST), then persists the entry.
 *
 * @param tx - Prisma transaction client used to persist the journal entry
 * @param tenantId - Tenant identifier for the journal entry
 * @param purchase - Purchase bill data used to construct lines, narration, and metadata
 * @returns The created journal entry record including its lines
 */
export async function journalForPurchaseBill(
  tx: PrismaTx,
  tenantId: string,
  purchase: PurchaseBillJournalInput
) {
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

  return createJournalEntry(tx, {
    tenantId,
    entryDate: purchase.billDate,
    narration: `Purchase from ${purchase.vendorName}`,
    voucherType: "PURCHASE",
    purchaseId: purchase.id,
    createdBy: purchase.createdBy,
    lines,
  });
}
