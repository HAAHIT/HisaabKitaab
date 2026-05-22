/**
 * Shared types for §5.10 bank statement reconciliation.
 */

export interface BankStatementRow {
  date: Date;
  description: string;
  /** Positive number — direction indicates flow */
  amount: number;
  direction: "INCOMING" | "OUTGOING";
  /** Original CSV line preserved for audit */
  rawLine: string;
}

export interface ParseResult {
  rows: BankStatementRow[];
  parseErrors: string[];
}
