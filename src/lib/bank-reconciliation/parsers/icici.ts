/**
 * ICICI Bank statement parser.
 * ICICI CSV format: Transaction Date, Value Date, Description, Ref No, Debit, Credit, Balance
 */

import type { ParseResult, BankStatementRow } from "../types";
import { parse as genericParse } from "./generic";

// ICICI format is close enough to generic — delegate with column override
export function parse(csv: string): ParseResult {
  // Normalize "Transaction Date" → "Date" so generic can find it
  const normalized = csv.replace(/Transaction Date/i, "Date").replace(/Value Date/i, "Value Date");
  return genericParse(normalized);
}
