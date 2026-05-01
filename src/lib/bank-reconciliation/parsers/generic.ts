/**
 * Generic CSV parser — fallback for banks not explicitly supported.
 * Expects columns: Date, Description, Debit, Credit, Balance (any order)
 * detected by column-header heuristics.
 */

import type { ParseResult, BankStatementRow } from "../types";

function parseAmount(s: string): number {
  return Math.abs(parseFloat(s.replace(/[₹,\s]/g, "")) || 0);
}

function parseDate(s: string): Date | null {
  // Try dd/mm/yyyy or dd-mm-yyyy or yyyy-mm-dd
  const cleaned = s.trim();
  const dmySlash = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmySlash) {
    const d = new Date(`${dmySlash[3]}-${dmySlash[2].padStart(2, "0")}-${dmySlash[1].padStart(2, "0")}T00:00:00.000Z`);
    if (!isNaN(d.getTime())) return d;
  }
  const iso = new Date(cleaned);
  return isNaN(iso.getTime()) ? null : iso;
}

function detectColumnIndices(headers: string[]): {
  dateIdx: number; descIdx: number; debitIdx: number; creditIdx: number;
} | null {
  const h = headers.map((x) => x.toLowerCase().trim());
  const dateIdx = h.findIndex((x) => x.includes("date") || x.includes("txn") || x.includes("value"));
  const descIdx = h.findIndex((x) => x.includes("desc") || x.includes("narr") || x.includes("particulars") || x.includes("remarks") || x.includes("detail"));
  const debitIdx = h.findIndex((x) => x === "debit" || x.includes("debit") || x.includes("dr") || x === "withdrawal");
  const creditIdx = h.findIndex((x) => x === "credit" || x.includes("credit") || x.includes("cr") || x === "deposit");
  if (dateIdx === -1 || descIdx === -1) return null;
  return { dateIdx, descIdx, debitIdx, creditIdx };
}

export function parse(csv: string): ParseResult {
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return { rows: [], parseErrors: ["CSV file is empty or has only a header row"] };

  const headers = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim());
  const cols = detectColumnIndices(headers);
  if (!cols) {
    return { rows: [], parseErrors: ["Could not detect date or description columns. Use the column mapper or try a supported bank format."] };
  }

  const rows: BankStatementRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    const fields = raw.split(",").map((f) => f.replace(/^"|"$/g, "").trim());
    if (fields.length < Math.max(cols.dateIdx, cols.descIdx) + 1) continue;

    const dateVal = parseDate(fields[cols.dateIdx]);
    if (!dateVal) { errors.push(`Row ${i + 1}: unrecognized date "${fields[cols.dateIdx]}"`); continue; }

    const desc = fields[cols.descIdx] || "";
    const debit = cols.debitIdx !== -1 ? parseAmount(fields[cols.debitIdx] || "0") : 0;
    const credit = cols.creditIdx !== -1 ? parseAmount(fields[cols.creditIdx] || "0") : 0;

    if (debit === 0 && credit === 0) continue; // skip summary/balance rows

    rows.push({
      date: dateVal,
      description: desc,
      amount: debit > 0 ? debit : credit,
      direction: credit > 0 ? "INCOMING" : "OUTGOING",
      rawLine: raw,
    });
  }

  return { rows, parseErrors: errors };
}
