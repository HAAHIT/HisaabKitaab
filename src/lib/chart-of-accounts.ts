export type AccountCode =
  | "SALES"
  | "PURCHASE"
  | "SUNDRY_DEBTORS"
  | "SUNDRY_CREDITORS"
  | "DIRECT_EXPENSE"
  | "INDIRECT_EXPENSE"
  | "DIRECT_INCOME"
  | "INDIRECT_INCOME"
  | "FIXED_ASSETS"
  | "LOANS_ADVANCES"
  | "CURRENT_LIABILITIES"
  | "CURRENT_ASSETS"
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
  | "OPENING_BALANCE"
  | "ROUND_OFF";

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
  DIRECT_EXPENSE: {
    code: "DIRECT_EXPENSE",
    name: "Direct Expenses",
    tallyGroup: "Direct Expenses",
    type: "EXPENSE",
    normalBalance: "DEBIT",
  },
  INDIRECT_EXPENSE: {
    code: "INDIRECT_EXPENSE",
    name: "Indirect Expenses",
    tallyGroup: "Indirect Expenses",
    type: "EXPENSE",
    normalBalance: "DEBIT",
  },
  DIRECT_INCOME: {
    code: "DIRECT_INCOME",
    name: "Direct Incomes",
    tallyGroup: "Direct Incomes",
    type: "INCOME",
    normalBalance: "CREDIT",
  },
  INDIRECT_INCOME: {
    code: "INDIRECT_INCOME",
    name: "Indirect Incomes",
    tallyGroup: "Indirect Incomes",
    type: "INCOME",
    normalBalance: "CREDIT",
  },
  FIXED_ASSETS: {
    code: "FIXED_ASSETS",
    name: "Fixed Assets",
    tallyGroup: "Fixed Assets",
    type: "ASSET",
    normalBalance: "DEBIT",
  },
  LOANS_ADVANCES: {
    code: "LOANS_ADVANCES",
    name: "Loans & Advances (Asset)",
    tallyGroup: "Loans & Advances (Asset)",
    type: "ASSET",
    normalBalance: "DEBIT",
  },
  CURRENT_LIABILITIES: {
    code: "CURRENT_LIABILITIES",
    name: "Current Liabilities",
    tallyGroup: "Current Liabilities",
    type: "LIABILITY",
    normalBalance: "CREDIT",
  },
  CURRENT_ASSETS: {
    code: "CURRENT_ASSETS",
    name: "Current Assets",
    tallyGroup: "Current Assets",
    type: "ASSET",
    normalBalance: "DEBIT",
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
  ROUND_OFF: {
    code: "ROUND_OFF",
    name: "Round Off",
    tallyGroup: "Indirect Expenses",
    type: "EXPENSE",
    normalBalance: "DEBIT",
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

/**
 * Maps a PartyType to the corresponding chart-of-accounts code for
 * journal entries. Used by the generic `journalForLedgerPayment` helper
 * to resolve the correct ledger account for non-customer/vendor parties.
 *
 * Tally equivalent mapping:
 *   CUSTOMER  → Sundry Debtors
 *   VENDOR    → Sundry Creditors
 *   EXPENSE   → Indirect Expenses (Rent, Office Exp, Travelling, etc.)
 *   INCOME    → Indirect Incomes (Interest, Commission, etc.)
 *   ASSET     → Fixed Assets (Machinery, Furniture, etc.)
 *   LIABILITY → Current Liabilities (EMI, Loans payable, etc.)
 *   EQUITY    → Capital Account
 */
export function partyTypeToAccountCode(partyType: string): AccountCode {
  switch (partyType) {
    case "CUSTOMER":
      return "SUNDRY_DEBTORS";
    case "VENDOR":
      return "SUNDRY_CREDITORS";
    case "EXPENSE":
      return "INDIRECT_EXPENSE";
    case "INCOME":
      return "INDIRECT_INCOME";
    case "ASSET":
      return "FIXED_ASSETS";
    case "LIABILITY":
      return "CURRENT_LIABILITIES";
    case "EQUITY":
      return "OWNER_EQUITY";
    default:
      return "SUNDRY_DEBTORS";
  }
}
