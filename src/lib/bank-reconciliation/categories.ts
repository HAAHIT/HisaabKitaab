import type { AccountCode } from "@/lib/chart-of-accounts";
import type { PayDirection } from "@prisma/client";

/**
 * Whitelist of account codes a user may assign to an unmatched bank statement row.
 * On commit, each row tagged here is auto-journaled: Dr Bank / Cr <code> for incoming
 * (or Dr <code> / Cr Bank for outgoing). Kept short by design — a non-accountant
 * picking from 23 chart-of-accounts entries is the wrong UX.
 */
export interface ReconcileCategoryOption {
  code: AccountCode;
  label: string;
  /** Which row directions this category is sensible for. */
  validFor: PayDirection[];
}

export const RECONCILE_CATEGORY_OPTIONS: ReconcileCategoryOption[] = [
  { code: "INDIRECT_EXPENSE", label: "Bank Charges / Fees", validFor: ["OUTGOING"] },
  { code: "INDIRECT_INCOME", label: "Bank Interest Credited", validFor: ["INCOMING"] },
  { code: "ROUND_OFF", label: "Round-off Adjustment", validFor: ["INCOMING", "OUTGOING"] },
  { code: "INDIRECT_EXPENSE", label: "Other Indirect Expense", validFor: ["OUTGOING"] },
  { code: "INDIRECT_INCOME", label: "Other Indirect Income", validFor: ["INCOMING"] },
];

const VALID_CATEGORY_CODES: Set<AccountCode> = new Set(
  RECONCILE_CATEGORY_OPTIONS.map((opt) => opt.code)
);

export function isValidReconcileCategoryCode(code: string): code is AccountCode {
  return VALID_CATEGORY_CODES.has(code as AccountCode);
}
