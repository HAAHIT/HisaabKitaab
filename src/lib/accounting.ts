import { roundTo2 } from "./journal-reporting";

export type SupportedPartyType = "CUSTOMER" | "VENDOR";
export type SupportedPayDirection = "INCOMING" | "OUTGOING";
export type SupportedBillStatus = "DRAFT" | "FINAL" | "CANCELLED";
export type PartyLedgerEntryType = "BILL" | "PAYMENT" | "OPENING" | "NOTE";

export type PartyLedgerEntry = {
  id: string;
  date: Date;
  type: PartyLedgerEntryType;
  description: string;
  debit: number;
  credit: number;
  balanceAfter: number;
  link?: string;
};

type PartyLedgerBill = {
  id: string;
  billNumber: string;
  grandTotal: number;
  createdAt: Date;
};

type PartyLedgerPayment = {
  id: string;
  amount: number;
  direction: SupportedPayDirection;
  mode: string;
  date: Date;
};

type PartyLedgerNote = {
  id: string;
  date: Date;
  voucherType: string;
  narration: string;
  debit: number;
  credit: number;
};

type PartyLedgerInput = {
  partyType: SupportedPartyType;
  openingBalance: number;
  createdAt: Date;
  bills: PartyLedgerBill[];
  payments: PartyLedgerPayment[];
  notes?: PartyLedgerNote[];
};

type BillSnapshotSource = {
  name: string;
  phone: string | null;
  address: string | null;
  gstin: string | null;
};

type BillSnapshotOverrides = {
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  gstin?: string | null;
};

function normalizeOptionalString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function buildBillSnapshotFromParty(
  party: BillSnapshotSource,
  overrides: BillSnapshotOverrides
) {
  return {
    customerName: normalizeOptionalString(overrides.customerName) ?? party.name,
    customerPhone: normalizeOptionalString(overrides.customerPhone) ?? party.phone,
    customerAddress:
      normalizeOptionalString(overrides.customerAddress) ?? party.address,
    gstin: normalizeOptionalString(overrides.gstin) ?? party.gstin,
  };
}

export function getPaymentBalanceDelta(
  partyType: SupportedPartyType,
  direction: SupportedPayDirection,
  amount: number
) {
  return direction === getSettlementDirectionForParty(partyType)
    ? amount
    : -amount;
}

export function getSettlementDirectionForParty(
  partyType: SupportedPartyType
): SupportedPayDirection {
  return partyType === "CUSTOMER" ? "INCOMING" : "OUTGOING";
}

export function getBillBalanceDelta(
  _partyType: SupportedPartyType,
  amount: number
) {
  return -amount;
}

export function getPostedBillBalanceDelta(
  partyType: SupportedPartyType,
  status: SupportedBillStatus,
  amount: number
) {
  if (status !== "FINAL") {
    return 0;
  }

  return getBillBalanceDelta(partyType, amount);
}

export function getBillBalanceDeltaForTransition({
  partyType,
  previousStatus,
  previousAmount,
  nextStatus,
  nextAmount,
}: {
  partyType: SupportedPartyType;
  previousStatus: SupportedBillStatus;
  previousAmount: number;
  nextStatus: SupportedBillStatus;
  nextAmount: number;
}) {
  return (
    getPostedBillBalanceDelta(partyType, nextStatus, nextAmount) -
    getPostedBillBalanceDelta(partyType, previousStatus, previousAmount)
  );
}

export function getLedgerAmountsForBalanceDelta(
  partyType: SupportedPartyType,
  balanceDelta: number
) {
  const amount = Math.abs(balanceDelta);
  if (amount === 0) {
    return { debit: 0, credit: 0 };
  }

  const positiveIsDebit = partyType === "VENDOR";
  if (balanceDelta > 0) {
    return positiveIsDebit
      ? { debit: amount, credit: 0 }
      : { debit: 0, credit: amount };
  }

  return positiveIsDebit
    ? { debit: 0, credit: amount }
    : { debit: amount, credit: 0 };
}

export function getBalanceIndicator(
  partyType: SupportedPartyType,
  balance: number
) {
  if (balance === 0) {
    return null;
  }

  if (partyType === "CUSTOMER") {
    return balance > 0 ? "Cr" : "Dr";
  }

  return balance > 0 ? "Dr" : "Cr";
}

export function getBalanceStatusLabel(
  partyType: SupportedPartyType,
  balance: number
) {
  if (balance === 0) {
    return "settled";
  }

  if (balance > 0) {
    return "advance balance";
  }

  return partyType === "CUSTOMER" ? "to receive" : "to pay";
}

export function getPartyBalanceColor(partyType: SupportedPartyType, balance: number) {
  const v = Math.round(balance * 100) / 100;
  if (v === 0) return "text-default-400";
  if (v > 0) return "text-warning";
  return partyType === "CUSTOMER" ? "text-success" : "text-danger";
}

export function formatPartyBalance(balance: number) {
  const v = Math.round(balance * 100) / 100;
  const formatted = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.abs(v));

  if (v === 0) return formatted;
  return v > 0 ? `+${formatted}` : formatted;
}

function getBillLedgerDescription(
  partyType: SupportedPartyType,
  billNumber: string
) {
  return partyType === "CUSTOMER"
    ? `Bill #${billNumber}`
    : `Purchase Bill #${billNumber}`;
}

function getPaymentLedgerDescription(
  direction: SupportedPayDirection,
  mode: string
) {
  return direction === "INCOMING"
    ? `Payment Received (${mode})`
    : `Payment Paid (${mode})`;
}

export function buildPartyLedger({
  partyType,
  openingBalance,
  createdAt,
  bills,
  payments,
  notes,
}: PartyLedgerInput) {
  let runningBalance = openingBalance;
  const openingEntry = getLedgerAmountsForBalanceDelta(
    partyType,
    openingBalance
  );

  const ledger: PartyLedgerEntry[] = [
    {
      id: "opening",
      date: createdAt,
      type: "OPENING",
      description: "Opening Balance",
      debit: openingEntry.debit,
      credit: openingEntry.credit,
      balanceAfter: runningBalance,
    },
  ];

  const allTransactions = [
    ...bills.map((bill) => ({
      txDate: bill.createdAt,
      kind: "BILL" as const,
      bill,
    })),
    ...payments.map((payment) => ({
      txDate: payment.date,
      kind: "PAYMENT" as const,
      payment,
    })),
    ...(notes || []).map((note) => ({
      txDate: note.date,
      kind: "NOTE" as const,
      note,
    })),
  ].sort((left, right) => left.txDate.getTime() - right.txDate.getTime());

  for (const transaction of allTransactions) {
    if (transaction.kind === "BILL") {
      const delta = getBillBalanceDelta(
        partyType,
        transaction.bill.grandTotal
      );
      runningBalance = roundTo2(runningBalance + delta);
      const entryAmounts = getLedgerAmountsForBalanceDelta(partyType, delta);

      ledger.push({
        id: transaction.bill.id,
        date: transaction.bill.createdAt,
        type: "BILL",
        description: getBillLedgerDescription(
          partyType,
          transaction.bill.billNumber
        ),
        debit: entryAmounts.debit,
        credit: entryAmounts.credit,
        balanceAfter: runningBalance,
        link: `/bills/${transaction.bill.id}`,
      });
    } else if (transaction.kind === "PAYMENT") {
      const delta = getPaymentBalanceDelta(
        partyType,
        transaction.payment.direction,
        transaction.payment.amount
      );
      runningBalance = roundTo2(runningBalance + delta);
      const entryAmounts = getLedgerAmountsForBalanceDelta(partyType, delta);

      ledger.push({
        id: transaction.payment.id,
        date: transaction.payment.date,
        type: "PAYMENT",
        description: getPaymentLedgerDescription(
          transaction.payment.direction,
          transaction.payment.mode
        ),
        debit: entryAmounts.debit,
        credit: entryAmounts.credit,
        balanceAfter: runningBalance,
      });
    } else if (transaction.kind === "NOTE") {
      // CREDIT_NOTE party line: credit=grandTotal, debit=0  → credit - debit = +grandTotal ✓
      // DEBIT_NOTE party line:  debit=grandTotal,  credit=0 → credit - debit = -grandTotal ✗
      // Both note types reduce the outstanding balance, so DEBIT_NOTE must use debit - credit.
      const delta =
        transaction.note.voucherType === "DEBIT_NOTE"
          ? transaction.note.debit - transaction.note.credit
          : transaction.note.credit - transaction.note.debit;
      runningBalance = roundTo2(runningBalance + delta);

      ledger.push({
        id: transaction.note.id,
        date: transaction.note.date,
        type: "NOTE",
        description: transaction.note.narration,
        debit: transaction.note.debit,
        credit: transaction.note.credit,
        balanceAfter: runningBalance,
      });
    }
  }

  return {
    ledger,
    calculatedCurrent: runningBalance,
  };
}

