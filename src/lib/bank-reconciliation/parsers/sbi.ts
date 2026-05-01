/**
 * SBI (State Bank of India) statement parser.
 * SBI CSV format: Txn Date, Value Date, Description, Ref No./Cheque No., Debit, Credit, Balance
 */

import type { ParseResult, BankStatementRow } from "../types";

function parseAmount(s: string): number {
  return Math.abs(parseFloat((s || "").replace(/[₹,\s]/g, "")) || 0);
}

function parseDate(s: string): Date | null {
  const m = (s || "").trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const d = new Date(`${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}T00:00:00.000Z`);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function parse(csv: string): ParseResult {
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  // SBI exports often have metadata rows at the top; find the header row
  let headerIdx = lines.findIndex((l) => /txn.?date/i.test(l) || /transaction.?date/i.test(l));
  if (headerIdx === -1) headerIdx = 0;

  const rows: BankStatementRow[] = [];
  const errors: string[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const raw = lines[i];
    const f = raw.split(",").map((x) => x.replace(/^"|"$/g, "").trim());
    if (f.length < 6) continue;

    const date = parseDate(f[0]);
    if (!date) { errors.push(`Row ${i + 1}: bad date "${f[0]}"`); continue; }

    const desc = f[2] || "";
    const debit = parseAmount(f[4]);
    const credit = parseAmount(f[5]);
    if (debit === 0 && credit === 0) continue;

    rows.push({
      date,
      description: desc,
      amount: debit > 0 ? debit : credit,
      direction: credit > 0 ? "INCOMING" : "OUTGOING",
      rawLine: raw,
    });
  }

  return { rows, parseErrors: errors };
}
