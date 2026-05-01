/**
 * Bank parser registry.
 * Maps bank slugs (as stored in BankAccount.bankName) to their parse functions.
 */

import { parse as parseSBI } from "./sbi";
import { parse as parseHDFC } from "./hdfc";
import { parse as parseICICI } from "./icici";
import { parse as parseAxis } from "./axis";
import { parse as parseKotak } from "./kotak";
import { parse as parsePNB } from "./pnb";
import { parse as parseBoB } from "./bob";
import { parse as parseGeneric } from "./generic";
import type { ParseResult } from "../types";

export type BankSlug =
  | "SBI"
  | "HDFC"
  | "ICICI"
  | "AXIS"
  | "KOTAK"
  | "PNB"
  | "BOB"
  | "GENERIC";

const parsers: Record<BankSlug, (csv: string) => ParseResult> = {
  SBI: parseSBI,
  HDFC: parseHDFC,
  ICICI: parseICICI,
  AXIS: parseAxis,
  KOTAK: parseKotak,
  PNB: parsePNB,
  BOB: parseBoB,
  GENERIC: parseGeneric,
};

export function parseStatement(bankSlug: string, csv: string): ParseResult {
  const slug = bankSlug.toUpperCase() as BankSlug;
  const parser = parsers[slug] ?? parseGeneric;
  return parser(csv);
}

/** All supported bank slugs for UI dropdowns */
export const SUPPORTED_BANKS: { slug: BankSlug; label: string }[] = [
  { slug: "SBI", label: "SBI (State Bank of India)" },
  { slug: "HDFC", label: "HDFC Bank" },
  { slug: "ICICI", label: "ICICI Bank" },
  { slug: "AXIS", label: "Axis Bank" },
  { slug: "KOTAK", label: "Kotak Mahindra Bank" },
  { slug: "PNB", label: "Punjab National Bank (PNB)" },
  { slug: "BOB", label: "Bank of Baroda (BoB)" },
  { slug: "GENERIC", label: "Other / Generic CSV" },
];
