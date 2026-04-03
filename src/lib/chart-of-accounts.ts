export type AccountCode =
  | "SALES"
  | "PURCHASE"
  | "SUNDRY_DEBTORS"
  | "SUNDRY_CREDITORS"
  | "CASH"
  | "BANK"
  | "UPI"
  | "CGST_OUTPUT"
  | "SGST_OUTPUT"
  | "IGST_OUTPUT"
  | "CGST_INPUT"
  | "SGST_INPUT"
  | "IGST_INPUT"
  | "OWNER_EQUITY"
  | "OPENING_BALANCE";

export interface AccountDefinition {
  code: AccountCode;
  name: string;
  tallyGroup: string;
  type: "ASSET" | "LIABILITY" | "INCOME" | "EXPENSE" | "EQUITY";
  normalBalance: "DEBIT" | "CREDIT";
}

export const CHART_OF_ACCOUNTS: Record<AccountCode, AccountDefinition> = {
  SALES: {
    code: "SALES",
    name: "Sales Account",
    tallyGroup: "Sales Accounts",
    type: "INCOME",
    normalBalance: "CREDIT",
  },
  PURCHASE: {
    code: "PURCHASE",
    name: "Purchase Account",
    tallyGroup: "Purchase Accounts",
    type: "EXPENSE",
    normalBalance: "DEBIT",
  },
  SUNDRY_DEBTORS: {
    code: "SUNDRY_DEBTORS",
    name: "Sundry Debtors",
    tallyGroup: "Sundry Debtors",
    type: "ASSET",
    normalBalance: "DEBIT",
  },
  SUNDRY_CREDITORS: {
    code: "SUNDRY_CREDITORS",
    name: "Sundry Creditors",
    tallyGroup: "Sundry Creditors",
    type: "LIABILITY",
    normalBalance: "CREDIT",
  },
  CASH: {
    code: "CASH",
    name: "Cash",
    tallyGroup: "Cash-in-Hand",
    type: "ASSET",
    normalBalance: "DEBIT",
  },
  BANK: {
    code: "BANK",
    name: "Bank Account",
    tallyGroup: "Bank Accounts",
    type: "ASSET",
    normalBalance: "DEBIT",
  },
  UPI: {
    code: "UPI",
    name: "UPI Account",
    tallyGroup: "Bank Accounts",
    type: "ASSET",
    normalBalance: "DEBIT",
  },
  CGST_OUTPUT: {
    code: "CGST_OUTPUT",
    name: "CGST Output",
    tallyGroup: "Duties & Taxes",
    type: "LIABILITY",
    normalBalance: "CREDIT",
  },
  SGST_OUTPUT: {
    code: "SGST_OUTPUT",
    name: "SGST Output",
    tallyGroup: "Duties & Taxes",
    type: "LIABILITY",
    normalBalance: "CREDIT",
  },
  IGST_OUTPUT: {
    code: "IGST_OUTPUT",
    name: "IGST Output",
    tallyGroup: "Duties & Taxes",
    type: "LIABILITY",
    normalBalance: "CREDIT",
  },
  CGST_INPUT: {
    code: "CGST_INPUT",
    name: "CGST Input",
    tallyGroup: "Duties & Taxes",
    type: "ASSET",
    normalBalance: "DEBIT",
  },
  SGST_INPUT: {
    code: "SGST_INPUT",
    name: "SGST Input",
    tallyGroup: "Duties & Taxes",
    type: "ASSET",
    normalBalance: "DEBIT",
  },
  IGST_INPUT: {
    code: "IGST_INPUT",
    name: "IGST Input",
    tallyGroup: "Duties & Taxes",
    type: "ASSET",
    normalBalance: "DEBIT",
  },
  OWNER_EQUITY: {
    code: "OWNER_EQUITY",
    name: "Capital Account",
    tallyGroup: "Capital Account",
    type: "EQUITY",
    normalBalance: "CREDIT",
  },
  OPENING_BALANCE: {
    code: "OPENING_BALANCE",
    name: "Opening Balance Equity",
    tallyGroup: "Capital Account",
    type: "EQUITY",
    normalBalance: "CREDIT",
  },
};

export function paymentModeToAccount(mode: string): AccountCode {
  switch (mode) {
    case "CASH":
      return "CASH";
    case "UPI":
      return "UPI";
    case "BANK":
    case "BANK_TRANSFER":
    case "CHEQUE":
      return "BANK";
    default:
      return "CASH";
  }
}
