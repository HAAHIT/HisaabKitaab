/**
 * Tally XML import parser
 *
 * Parses Tally ERP 9 / Tally Prime XML export format into
 * structured vouchers and party masters that can be committed to the DB.
 *
 * Handles both HisaabKitaab-exported XML (re-import) and native Tally exports.
 */

import { XMLParser } from "fast-xml-parser";
import type { AccountCode } from "./chart-of-accounts";

// ── Ledger name → AccountCode mapping ────────────────────────────────────────
// Covers HisaabKitaab account names and common Tally short names.

const LEDGER_TO_CODE: Record<string, AccountCode> = {
  // Income / Expense
  "Sales Account": "SALES",
  Sales: "SALES",
  "Purchase Account": "PURCHASE",
  Purchase: "PURCHASE",
  // Party groups (used in HisaabKitaab exports)
  "Sundry Debtors": "SUNDRY_DEBTORS",
  "Sundry Creditors": "SUNDRY_CREDITORS",
  // Payment instruments
  Cash: "CASH",
  "Cash-in-Hand": "CASH",
  "Bank Account": "BANK",
  Bank: "BANK",
  "UPI Account": "UPI",
  UPI: "UPI",
  // GST — output (liability)
  "CGST Output": "CGST_OUTPUT",
  CGST: "CGST_OUTPUT",
  "SGST Output": "SGST_OUTPUT",
  SGST: "SGST_OUTPUT",
  "IGST Output": "IGST_OUTPUT",
  IGST: "IGST_OUTPUT",
  // GST — input (asset)
  "CGST Input": "CGST_INPUT",
  "SGST Input": "SGST_INPUT",
  "IGST Input": "IGST_INPUT",
  // Equity
  "Capital Account": "OWNER_EQUITY",
  "Opening Balance Equity": "OPENING_BALANCE",
};

// Infer accountCode for unknown ledger names based on voucher context.
const FALLBACK_BY_VOUCHER: Record<string, AccountCode> = {
  SALES: "SUNDRY_DEBTORS",
  RECEIPT: "SUNDRY_DEBTORS",
  PURCHASE: "SUNDRY_CREDITORS",
  PAYMENT: "SUNDRY_CREDITORS",
  JOURNAL: "SUNDRY_DEBTORS",
};

const VOUCHER_TYPE_MAP: Record<
  string,
  "SALES" | "PURCHASE" | "RECEIPT" | "PAYMENT" | "JOURNAL"
> = {
  Sales: "SALES",
  Purchase: "PURCHASE",
  Receipt: "RECEIPT",
  Payment: "PAYMENT",
  Journal: "JOURNAL",
  Contra: "JOURNAL",
};

// ── Output types ─────────────────────────────────────────────────────────────

export type ParsedLedgerLine = {
  ledgerName: string;
  accountCode: AccountCode;
  /** Party name from BILLALLOCATIONS.LIST or the ledger name itself (for unknown ledgers) */
  partyName: string | null;
  debit: number;
  credit: number;
};

export type ParsedVoucher = {
  voucherType: "SALES" | "PURCHASE" | "RECEIPT" | "PAYMENT" | "JOURNAL";
  entryDate: Date;
  reference: string;
  narration: string;
  lines: ParsedLedgerLine[];
  totalDebit: number;
};

export type ParsedPartyMaster = {
  name: string;
  group: "Sundry Debtors" | "Sundry Creditors";
  openingBalance: number;
};

export type TallyParseResult = {
  vouchers: ParsedVoucher[];
  partyMasters: ParsedPartyMaster[];
  parseErrors: string[];
};

/**
 * Parses a Tally-style date string in `YYYYMMDD` format and returns a UTC Date.
 *
 * @param raw - Value containing the date string (commonly a string or number)
 * @returns A `Date` representing the parsed UTC date, or `null` if the input is missing, not exactly 8 characters, or invalid
 */

function parseTallyDate(raw: unknown): Date | null {
  const s = String(raw ?? "").trim();
  if (s.length !== 8) return null;
  const year = parseInt(s.slice(0, 4), 10);
  const month = parseInt(s.slice(4, 6), 10) - 1;
  const day = parseInt(s.slice(6, 8), 10);
  const d = new Date(Date.UTC(year, month, day));
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Converts various raw representations of a numeric amount into a safe number.
 *
 * @param raw - A value that may be a number, numeric string, empty string, `null`, or `undefined`
 * @returns The numeric value represented by `raw`, or `0` if `raw` is empty, invalid, or not a number
 */
function parseAmount(raw: unknown): number {
  if (raw === undefined || raw === null || raw === "") return 0;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  return isNaN(n) ? 0 : n;
}

/**
 * Extracts the party name from the first bill allocation within a ledger entry.
 *
 * @param entry - Ledger record that may contain a `BILLALLOCATIONS.LIST` node
 * @returns The trimmed `NAME` from the first item of `BILLALLOCATIONS.LIST`, or `null` if no valid name is found
 */
function extractBillAllocPartyName(entry: Record<string, unknown>): string | null {
  const alloc = entry["BILLALLOCATIONS.LIST"];
  if (!alloc) return null;
  const first = Array.isArray(alloc) ? alloc[0] : alloc;
  if (!first || typeof first !== "object") return null;
  const name = (first as Record<string, unknown>)["NAME"];
  return typeof name === "string" ? name.trim() || null : null;
}

/**
 * Normalize a possibly absent or singular value into an array.
 *
 * @param value - A single element, an array of elements, or `null`/`undefined`
 * @returns The original array if `value` is an array, a single-element array containing `value` if it is a single element, or an empty array when `value` is `null` or `undefined`
 */
function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Parses a Tally ERP / Tally Prime XML export into in-memory voucher and party-master records while collecting parse errors.
 *
 * The parser tolerates multiple ENVELOPE documents, extracts LEDGER entries as party masters (only Sundry Debtors/Creditors),
 * and converts VOUCHER entries into ParsedVoucher objects with resolved account codes, ledger lines, and totals.
 * Malformed or unsupported messages are skipped and described in the returned `parseErrors` array.
 *
 * @param xmlText - The raw Tally XML export text to parse
 * @returns An object containing `vouchers`, `partyMasters`, and `parseErrors` describing any issues encountered during parsing
 */

export function parseTallyXml(xmlText: string): TallyParseResult {
  const parseErrors: string[] = [];
  const vouchers: ParsedVoucher[] = [];
  const partyMasters: ParsedPartyMaster[] = [];

  let parsed: Record<string, unknown>;
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      isArray: (name: string) =>
        ["TALLYMESSAGE", "ALLLEDGERENTRIES.LIST", "BILLALLOCATIONS.LIST"].includes(name),
      parseTagValue: true,
      parseAttributeValue: false,
    });
    parsed = parser.parse(xmlText) as Record<string, unknown>;
  } catch (err) {
    return {
      vouchers: [],
      partyMasters: [],
      parseErrors: [
        `XML parse error: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  // Navigate to TALLYMESSAGE array — handle both single-doc and concatenated docs
  const messageCollections: unknown[][] = [];
  try {
    // fast-xml-parser may produce an array of ENVELOPEs if there are multiple XML declarations
    const envelopes = asArray(parsed["ENVELOPE"]);
    for (const env of envelopes) {
      const envelope = env as Record<string, unknown>;
      const body = envelope?.["BODY"] as Record<string, unknown> | undefined;
      const importData = body?.["IMPORTDATA"] as Record<string, unknown> | undefined;
      const requestData = importData?.["REQUESTDATA"] as Record<string, unknown> | undefined;
      const raw = requestData?.["TALLYMESSAGE"];
      if (raw) {
        messageCollections.push(asArray(raw));
      }
    }
  } catch {
    parseErrors.push("Could not locate TALLYMESSAGE elements in XML");
    return { vouchers, partyMasters, parseErrors };
  }

  if (messageCollections.length === 0) {
    parseErrors.push("No TALLYMESSAGE elements found in XML");
    return { vouchers, partyMasters, parseErrors };
  }

  const allMessages = messageCollections.flat();

  for (let i = 0; i < allMessages.length; i++) {
    const msg = allMessages[i] as Record<string, unknown>;

    // ── Party master ─────────────────────────────────────────────────────────
    if (msg["LEDGER"]) {
      const ledger = msg["LEDGER"] as Record<string, unknown>;
      const name = String(ledger["NAME"] ?? ledger["@_NAME"] ?? "").trim();
      const parent = String(ledger["PARENT"] ?? "").trim();
      if (!name) continue;
      if (parent !== "Sundry Debtors" && parent !== "Sundry Creditors") continue;
      const openingBalance = parseAmount(ledger["OPENINGBALANCE"]);
      partyMasters.push({
        name,
        group: parent as "Sundry Debtors" | "Sundry Creditors",
        openingBalance,
      });
      continue;
    }

    // ── Voucher ──────────────────────────────────────────────────────────────
    if (!msg["VOUCHER"]) continue;
    const v = msg["VOUCHER"] as Record<string, unknown>;

    const typeName = String(v["VOUCHERTYPENAME"] ?? v["@_VCHTYPE"] ?? "").trim();
    const voucherType = VOUCHER_TYPE_MAP[typeName];
    if (!voucherType) {
      parseErrors.push(
        `Message ${i + 1}: unknown voucher type "${typeName}", skipping`
      );
      continue;
    }

    const entryDate = parseTallyDate(v["DATE"]);
    if (!entryDate) {
      parseErrors.push(
        `Message ${i + 1}: invalid date "${v["DATE"]}", skipping`
      );
      continue;
    }

    const reference = String(v["VOUCHERNUMBER"] ?? "").trim();
    const narration = String(v["NARRATION"] ?? "").trim();

    const rawEntries = v["ALLLEDGERENTRIES.LIST"];
    const entryList = asArray(rawEntries as Record<string, unknown> | Record<string, unknown>[] | undefined);

    const lines: ParsedLedgerLine[] = [];
    for (const entry of entryList) {
      const e = entry as Record<string, unknown>;
      const ledgerName = String(e["LEDGERNAME"] ?? "").trim();
      if (!ledgerName) continue;

      const amountRaw = parseAmount(e["AMOUNT"]);
      const isDeemedPositive =
        String(e["ISDEEMEDPOSITIVE"] ?? "").trim().toLowerCase() === "yes";

      // Reconstruct debit/credit from ISDEEMEDPOSITIVE and signed AMOUNT
      const absAmount = Math.abs(amountRaw);
      const isDebit = isDeemedPositive || amountRaw > 0;
      const debit = isDebit ? absAmount : 0;
      const credit = isDebit ? 0 : absAmount;

      if (absAmount === 0) continue;

      const resolvedCode = LEDGER_TO_CODE[ledgerName];
      // Unknown ledger name = treat as party ledger; infer group from voucher type
      const accountCode: AccountCode =
        resolvedCode ?? FALLBACK_BY_VOUCHER[voucherType] ?? "SUNDRY_DEBTORS";

      // partyName: from BILLALLOCATIONS if present, otherwise the ledger name itself
      // (for real Tally exports where party name IS the ledger name)
      const billAllocName = extractBillAllocPartyName(e);
      const partyName =
        billAllocName ??
        (resolvedCode === undefined ? ledgerName : null);

      lines.push({ ledgerName, accountCode, partyName, debit, credit });
    }

    if (lines.length === 0) {
      parseErrors.push(
        `Message ${i + 1}: voucher "${reference}" has no ledger entries, skipping`
      );
      continue;
    }

    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);

    vouchers.push({ voucherType, entryDate, reference, narration, lines, totalDebit });
  }

  return { vouchers, partyMasters, parseErrors };
}
