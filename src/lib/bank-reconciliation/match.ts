/**
 * Bank Reconciliation — Matching Algorithm
 *
 * A bank row auto-matches a Payment when ALL four conditions hold:
 *  1. Amount within ₹1 tolerance
 *  2. Direction matches (INCOMING ↔ payment type)
 *  3. Date proximity: ±3 calendar days
 *  4. Bank description contains a substring of the party name (or vice-versa)
 */

import type { BankStatementRow } from "./types";

/** Minimal shape of a Payment record needed for matching */
export interface MatchablePayment {
  id: string;
  amount: number;
  /** "INCOMING" for money received from customer; "OUTGOING" for money paid to vendor */
  direction: "INCOMING" | "OUTGOING";
  date: Date;
  /** Party name used for description substring match */
  partyName: string | null;
}

export interface MatchResult {
  bankRow: BankStatementRow;
  /** Best matching payment, if found */
  payment: MatchablePayment | null;
  /** 0–100 confidence score */
  confidence: number;
  /** Human-readable reason summary */
  reason: string;
}

const AMOUNT_TOLERANCE = 1; // ₹1
const DATE_TOLERANCE_DAYS = 3;

function daysDiff(a: Date, b: Date): number {
  return Math.abs((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function normalizeStr(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

/** Returns true if partyName is meaningfully present in the bank description */
function descriptionMatches(bankDesc: string, partyName: string | null): boolean {
  if (!partyName) return false;
  const desc = normalizeStr(bankDesc);
  const party = normalizeStr(partyName);

  // Try each word of the party name (≥3 chars) for substring match
  const words = party.split(" ").filter((w) => w.length >= 3);
  if (words.length === 0) return false;

  // At least one significant word must appear in the bank description
  return words.some((w) => desc.includes(w));
}

/**
 * Score a single (bankRow, payment) pair. Returns 0 if any hard condition fails.
 */
function scorePair(row: BankStatementRow, payment: MatchablePayment): number {
  // Hard gate 1: direction
  if (row.direction !== payment.direction) return 0;

  // Hard gate 2: amount within tolerance
  if (Math.abs(row.amount - payment.amount) > AMOUNT_TOLERANCE) return 0;

  // Hard gate 3: date within ±3 days
  const dateDiff = daysDiff(row.date, payment.date);
  if (dateDiff > DATE_TOLERANCE_DAYS) return 0;

  // Score 0–100 based on closeness
  // Amount exactness: 40 points
  const amountScore = 40 * (1 - Math.abs(row.amount - payment.amount) / AMOUNT_TOLERANCE);

  // Date closeness: 40 points (0 diff = 40, 3 diff = 0)
  const dateScore = 40 * (1 - dateDiff / (DATE_TOLERANCE_DAYS + 1));

  // Description match: 20 points
  const descScore = descriptionMatches(row.description, payment.partyName) ? 20 : 0;

  return Math.round(amountScore + dateScore + descScore);
}

/**
 * For each bank row, find the best-matching payment from the candidate list.
 * Payments already assigned are not reused (greedy, highest-confidence first).
 */
export function matchRows(
  bankRows: BankStatementRow[],
  payments: MatchablePayment[]
): MatchResult[] {
  // Build score matrix
  type ScoredPair = { rowIdx: number; payIdx: number; score: number };
  const pairs: ScoredPair[] = [];

  for (let ri = 0; ri < bankRows.length; ri++) {
    for (let pi = 0; pi < payments.length; pi++) {
      const score = scorePair(bankRows[ri], payments[pi]);
      if (score > 0) pairs.push({ rowIdx: ri, payIdx: pi, score });
    }
  }

  // Sort descending by score — greedy assignment
  pairs.sort((a, b) => b.score - a.score);

  const assignedRows = new Set<number>();
  const assignedPayments = new Set<number>();
  const rowToPayment = new Map<number, { payIdx: number; score: number }>();

  for (const pair of pairs) {
    if (assignedRows.has(pair.rowIdx)) continue;
    if (assignedPayments.has(pair.payIdx)) continue;
    rowToPayment.set(pair.rowIdx, { payIdx: pair.payIdx, score: pair.score });
    assignedRows.add(pair.rowIdx);
    assignedPayments.add(pair.payIdx);
  }

  // Build results
  return bankRows.map((row, ri) => {
    const match = rowToPayment.get(ri);
    if (!match) {
      return {
        bankRow: row,
        payment: null,
        confidence: 0,
        reason: "No matching payment found",
      };
    }
    const payment = payments[match.payIdx];
    const dateDiff = daysDiff(row.date, payment.date);
    const descHit = descriptionMatches(row.description, payment.partyName);
    const reason = [
      `Amount ₹${row.amount} ≈ ₹${payment.amount}`,
      `Date diff ${dateDiff}d`,
      descHit ? "Description match" : "No description match",
    ].join("; ");

    return { bankRow: row, payment, confidence: match.score, reason };
  });
}
