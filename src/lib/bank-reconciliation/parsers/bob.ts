/**
 * Bank of Baroda (BoB) statement parser.
 * BoB CSV format: Transaction Date, Description, Ref Number, Debit, Credit, Balance
 */

import type { ParseResult, BankStatementRow } from "../types";

function parseAmount(s: string): number {
  return Math.abs(parseFloat((s || "").replace(/[₹,\s]/g, "")) || 0);
}

function parseDate(s: string): Date | null {
  // Supports dd/mm/yyyy, dd-mm-yyyy, dd/mm/yy, and yyyy-mm-dd (ISO)
  const iso = (s || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00.000Z`);
    return isNaN(d.getTime()) ? null : d;
  }
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
  // BoB header typically contains "Transaction Date" or "Txn Date"
  let headerIdx = lines.findIndex(
    (l) => /transaction.?date/i.test(l) || /txn.?date/i.test(l)
  );
  if (headerIdx === -1) {
    // Fallback: find first row with "date" and "debit"/"credit"
    headerIdx = lines.findIndex(
      (l) => /date/i.test(l) && (/debit/i.test(l) || /credit/i.test(l))
    );
  }
  if (headerIdx === -1) headerIdx = 0;

  const rows: BankStatementRow[] = [];
  const errors: string[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const raw = lines[i];
    const f = raw.split(",").map((x) => x.replace(/^"|"$/g, "").trim());
    if (f.length < 5) continue;

    const date = parseDate(f[0]);
    if (!date) { errors.push(`Row ${i + 1}: bad date "${f[0]}"`); continue; }

    // BoB: col 0=txn date, 1=description, 2=ref no, 3=debit, 4=credit, 5=balance
    const desc = f[1] || "";
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
