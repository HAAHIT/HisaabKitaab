/**
 * Punjab National Bank (PNB) statement parser.
 * PNB CSV format: Txn Date, Value Date, Description, Ref No, Debit, Credit, Balance
 * (Same layout as SBI — delegate with header tweak)
 */

import type { ParseResult, BankStatementRow } from "../types";

function parseAmount(s: string): number {
  return Math.abs(parseFloat((s || "").replace(/[₹,\s]/g, "")) || 0);
}

function parseDate(s: string): Date | null {
  // Supports dd/mm/yyyy, dd-mm-yyyy, dd/mm/yy
  const m = (s || "").trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    const d = new Date(`${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}T00:00:00.000Z`);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function parse(csv: string): ParseResult {
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  // PNB exports may have metadata rows; find header by "date" + "debit"/"credit"
  let headerIdx = lines.findIndex(
    (l) => /date/i.test(l) && (/debit/i.test(l) || /credit/i.test(l))
  );
  if (headerIdx === -1) headerIdx = 0;

  const rows: BankStatementRow[] = [];
  const errors: string[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const raw = lines[i];
    const f = raw.split(",").map((x) => x.replace(/^"|"$/g, "").trim());
    if (f.length < 6) continue;

    const date = parseDate(f[0]);
    if (!date) { errors.push(`Row ${i + 1}: bad date "${f[0]}"`); continue; }

    // PNB: col 0=txn date, 1=value date, 2=description, 3=ref no, 4=debit, 5=credit, 6=balance
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
