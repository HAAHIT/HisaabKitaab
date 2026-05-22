/**
 * Axis Bank statement parser.
 * Axis CSV format: Tran Date, CHQNO, PARTICULARS, DR, CR, BAL
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
  let headerIdx = lines.findIndex((l) => /tran.?date/i.test(l) || /particulars/i.test(l));
  if (headerIdx === -1) headerIdx = 0;

  const rows: BankStatementRow[] = [];
  const errors: string[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const raw = lines[i];
    const f = raw.split(",").map((x) => x.replace(/^"|"$/g, "").trim());
    if (f.length < 5) continue;

    const date = parseDate(f[0]);
    if (!date) { errors.push(`Row ${i + 1}: bad date "${f[0]}"`); continue; }

    // Axis: col 0=date, 1=chqno, 2=particulars, 3=DR, 4=CR, 5=BAL
    const desc = f[2] || "";
    const debit = parseAmount(f[3]);
    const credit = parseAmount(f[4]);
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
