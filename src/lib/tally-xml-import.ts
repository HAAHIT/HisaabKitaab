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
import { stateNameToGstCode } from "./gst-states";

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

// ── Tally group → AccountCode mapping ───────────────────────────────────────
// Maps Tally's standard account group names (as they appear in <PARENT>) to
// our internal AccountCode. "Duties & Taxes" is handled by resolveGstAccountCode.
// Groups whose AccountCode was removed from this branch are omitted (they fall
// through to the pattern-based resolver or voucher-type fallback).

const TALLY_GROUP_TO_ACCOUNT_CODE: Partial<Record<string, AccountCode>> = {
  "Sales Accounts": "SALES",
  "Purchase Accounts": "PURCHASE",
  "Sundry Debtors": "SUNDRY_DEBTORS",
  "Sundry Creditors": "SUNDRY_CREDITORS",
  "Bank Accounts": "BANK",
  "Bank OD A/c": "BANK",
  "Cash-in-Hand": "CASH",
  "Capital Account": "OWNER_EQUITY",
  "Reserves & Surplus": "OWNER_EQUITY",
};

/**
 * Resolves CGST/SGST/IGST + PAYABLE/RECEIVABLE from ledger name.
 * Handles Tally naming quirks: "C Gst Payable @ 6%", "C-GST Receivable",
 * "S Gst Receiceivable @ 6%" (typos), etc.
 */
function resolveGstAccountCode(ledgerName: string): AccountCode | null {
  const upper = ledgerName.toUpperCase();
  const isCgst = /\bC[\s-]?GST\b/i.test(ledgerName) || upper.includes("CGST");
  const isSgst = /\bS[\s-]?GST\b/i.test(ledgerName) || upper.includes("SGST");
  const isIgst = /\bI[\s-]?GST\b/i.test(ledgerName) || upper.includes("IGST");
  // "RECEIV" catches both "RECEIVABLE" and Tally typos like "RECEICEIVABLE"
  const isReceivable = upper.includes("RECEIV");

  if (isCgst) return isReceivable ? "CGST_INPUT" : "CGST_OUTPUT";
  if (isSgst) return isReceivable ? "SGST_INPUT" : "SGST_OUTPUT";
  if (isIgst) return isReceivable ? "IGST_INPUT" : "IGST_OUTPUT";

  return null; // TDS / other Duties & Taxes — no matching AccountCode in this branch
}

/**
 * Resolves AccountCode using the Tally group name from a LEDGER record.
 * "Duties & Taxes" delegates to resolveGstAccountCode for sub-classification.
 */
function resolveFromTallyGroup(
  group: string,
  ledgerName: string
): AccountCode | null {
  if (group === "Duties & Taxes") return resolveGstAccountCode(ledgerName);
  return TALLY_GROUP_TO_ACCOUNT_CODE[group] ?? null;
}

/**
 * Pattern-based heuristic for resolving AccountCode from ledger names when
 * no LEDGER group info is available (e.g. DayBook-only import without Master.xml).
 *
 * Patterns are ordered from most-specific to least-specific.
 * Returns null for unrecognised names (caller falls back to voucher-type inference).
 */
function resolveAccountCodeByPattern(ledgerName: string): AccountCode | null {
  const upper = ledgerName.toUpperCase();

  // ── GST tax accounts (Duties & Taxes) ─────────────────────────────────────
  const isCgst = /\bC[\s-]?GST\b/i.test(ledgerName) || upper.includes("CGST");
  const isSgst = /\bS[\s-]?GST\b/i.test(ledgerName) || upper.includes("SGST");
  const isIgst = /\bI[\s-]?GST\b/i.test(ledgerName) || upper.includes("IGST");

  if (isCgst || isSgst || isIgst) {
    const isReceivable = upper.includes("RECEIV");
    if (isCgst) return isReceivable ? "CGST_INPUT" : "CGST_OUTPUT";
    if (isSgst) return isReceivable ? "SGST_INPUT" : "SGST_OUTPUT";
    if (isIgst) return isReceivable ? "IGST_INPUT" : "IGST_OUTPUT";
  }

  // ── GST-prefixed sales / purchase accounts ────────────────────────────────
  // "Gst Sales @ 18 %", "Igst Sales @ 12 %"
  if (/\bI?GST\s+SALES\b/i.test(ledgerName)) return "SALES";
  if (/\bI?GST\s+PURCHASE/i.test(ledgerName)) return "PURCHASE";

  // ── Sales A/c pattern ─────────────────────────────────────────────────────
  if (/SALES\s*A\/?C/i.test(ledgerName)) return "SALES";

  // ── Purchases A/c pattern ─────────────────────────────────────────────────
  if (/PURCHASES?\s*A\/?C/i.test(ledgerName)) return "PURCHASE";

  // ── Debit Note / Credit Note accounts ─────────────────────────────────────
  if (/\bDEBIT\s*NOTE\b/i.test(ledgerName)) return "PURCHASE";
  if (/\bCREDIT\s*NOTE\b/i.test(ledgerName)) return "SALES";

  // ── Round off ─────────────────────────────────────────────────────────────
  if (/\bROUND/i.test(ledgerName)) return "ROUND_OFF";

  // ── Bank accounts ─────────────────────────────────────────────────────────
  if (/\bBANK\b/i.test(ledgerName) && /\b(A\/?C|LTD|ACCOUNT|CURRENT)\b/i.test(ledgerName)) return "BANK";

  // ── Capital / Partner accounts ────────────────────────────────────────────
  if (/CAPITAL\s*A\/?C/i.test(ledgerName)) return "OWNER_EQUITY";

  return null;
}

/**
 * Maps Tally's voucher type name strings (both HisaabKitaab exports and
 * native TallyPrime exports) to our internal VoucherType enum values.
 */
const VOUCHER_TYPE_MAP: Record<
  string,
  "SALES" | "PURCHASE" | "RECEIPT" | "PAYMENT" | "JOURNAL"
> = {
  // Standard types (HisaabKitaab exports + native Tally)
  Sales: "SALES",
  Purchase: "PURCHASE",
  Receipt: "RECEIPT",
  Payment: "PAYMENT",
  Journal: "JOURNAL",
  Contra: "JOURNAL",
  // GST return types — native TallyPrime export strings
  "Sales Return": "SALES",
  "Credit Note": "SALES",
  "Purchase Return": "PURCHASE",
  "Debit Note": "PURCHASE",
};

/**
 * Heuristic lookup for voucher types with custom names (e.g. "GST Sales").
 * Maps substring to primary voucher category.
 */
const VCH_HEURISTIC: Record<string, "SALES" | "PURCHASE" | "RECEIPT" | "PAYMENT" | "JOURNAL"> = {
  SALES: "SALES",
  PURCHASE: "PURCHASE",
  RECEIPT: "RECEIPT",
  PAYMENT: "PAYMENT",
  JOURNAL: "JOURNAL",
  CONTRA: "JOURNAL",
  INVOICE: "SALES",
};

// ── Output types ─────────────────────────────────────────────────────────────

export type ParsedLedgerLine = {
  ledgerName: string;
  accountCode: AccountCode;
  /** Party name from PARTYLEDGERNAME or the ledger name itself (for native Tally exports) */
  partyName: string | null;
  debit: number;
  credit: number;
};

export type ParsedVoucher = {
  voucherType: "SALES" | "PURCHASE" | "RECEIPT" | "PAYMENT" | "JOURNAL";
  /**
   * The original Tally voucher type name string (e.g. "Sales Return").
   * Preserved so callers can detect Credit Notes / Debit Notes that should be
   * mapped to CREDIT_NOTE at the journal-write layer.
   */
  originalTypeName: string;
  entryDate: Date;
  reference: string;
  narration: string;
  lines: ParsedLedgerLine[];
  totalDebit: number;
  /**
   * Tally's <REMOTEID> or <GUID> tag value with "HisaabKitaab-" prefix stripped.
   * Used as the primary idempotency key on import (stored in JournalEntry.remoteId).
   * Null for native Tally XML that does not carry a REMOTEID.
   */
  remoteId: string | null;
  /** 2-digit GST state code reverse-looked up from Tally's state name. Null when absent. */
  placeOfSupply: string | null;
  /** First tax rate found in GSTDETAILS.LIST (e.g. 18). Null when absent. */
  taxPercent: number | null;
  /** HSN/SAC codes extracted from GSTDETAILS.LIST HSNCODE tags. */
  hsnCodes: string[];
  /**
   * True if ledger entries contain IGST-related accounts (indicating inter-state supply).
   * Determined by scanning ledger names for "IGST" vs "CGST"/"SGST" keywords.
   * Null when no GST ledger entries are present (e.g. exempt supplies).
   */
  isInterState: boolean | null;
};

export type ParsedPartyMaster = {
  name: string;
  group: "Sundry Debtors" | "Sundry Creditors";
  openingBalance: number;
  /** GSTIN extracted from Tally's <PARTYGSTIN> tag. Null when absent. */
  gstin: string | null;
  /** Address extracted from Tally's <ADDRESS.LIST> tag. Null when absent. */
  address: string | null;
};

export type TallyParseResult = {
  vouchers: ParsedVoucher[];
  partyMasters: ParsedPartyMaster[];
  parseErrors: string[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parses a Tally YYYYMMDD date string as IST noon (06:30 UTC).
 *
 * Tally dates are calendar dates in IST (UTC+5:30). Storing them as midnight
 * UTC causes the date to roll back one day when viewed in IST, which breaks
 * the duplicate-fingerprint check (entryDate.toISOString().slice(0,10)).
 * Using 06:30 UTC (= 12:00 IST noon) keeps the YYYY-MM-DD portion
 * identical regardless of server timezone or DST edge cases.
 */
export function parseTallyDate(raw: unknown): Date | null {
  const s = String(raw ?? "").trim();
  if (s.length !== 8) return null;
  const year = parseInt(s.slice(0, 4), 10);
  const monthRaw = parseInt(s.slice(4, 6), 10);
  const day = parseInt(s.slice(6, 8), 10);

  if (monthRaw < 1 || monthRaw > 12 || day < 1 || day > 31) return null;

  const month = monthRaw - 1;
  const d = new Date(Date.UTC(year, month, day, 6, 30, 0));
  if (isNaN(d.getTime())) return null;
  // Validate day didn't roll over (e.g. Feb 31 → Mar 3)
  if (d.getUTCMonth() !== month || d.getUTCDate() !== day) return null;
  return d;
}

function parseAmount(raw: unknown): number {
  if (raw === undefined || raw === null || raw === "") return 0;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  return isNaN(n) ? 0 : n;
}

function extractBillAllocationName(entry: Record<string, unknown>): string | null {
  const alloc = entry["BILLALLOCATIONS.LIST"];
  if (!alloc) return null;
  const first = Array.isArray(alloc) ? alloc[0] : alloc;
  if (!first || typeof first !== "object") return null;
  const name = (first as Record<string, unknown>)["NAME"];
  return typeof name === "string" ? name.trim() || null : null;
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function isPartyAccountCode(accountCode: AccountCode): boolean {
  return accountCode === "SUNDRY_DEBTORS" || accountCode === "SUNDRY_CREDITORS";
}

// ── Main parser ───────────────────────────────────────────────────────────────

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
        [
          "TALLYMESSAGE",
          "ALLLEDGERENTRIES.LIST",
          "LEDGERENTRIES.LIST",
          "BILLALLOCATIONS.LIST",
          "ALLINVENTORYENTRIES.LIST",
          "INVENTORYENTRIES.LIST",
        ].includes(name),
      parseTagValue: true,
      parseAttributeValue: false,
      maxNestedTags: 10000,
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

  // Navigate to TALLYMESSAGE array.
  // HisaabKitaab XML uses BODY > IMPORTDATA > REQUESTDATA.
  // Native Tally exports use BODY > DATA > TALLYMESSAGE, and some exports
  // wrap LEDGER/VOUCHER nodes directly in BODY > DATA > COLLECTION.
  const messageCollections: unknown[][] = [];
  try {
    const collectMessages = (container: Record<string, unknown> | undefined) => {
      if (!container) return;

      const raw = container["TALLYMESSAGE"];
      if (raw) {
        messageCollections.push(asArray(raw));
      }

      const collection = container["COLLECTION"] as Record<string, unknown> | undefined;
      if (!collection) return;

      const collectionMessages: unknown[] = [
        ...asArray(collection["LEDGER"] as unknown).map((ledger) => ({ LEDGER: ledger })),
        ...asArray(collection["VOUCHER"] as unknown).map((voucher) => ({ VOUCHER: voucher })),
      ];
      if (collectionMessages.length > 0) {
        messageCollections.push(collectionMessages);
      }
    };

    const envelopes = asArray(parsed["ENVELOPE"]);
    for (const env of envelopes) {
      const envelope = env as Record<string, unknown>;
      const body = envelope?.["BODY"] as Record<string, unknown> | undefined;
      collectMessages(body);

      // Use asArray — combined exports have multiple IMPORTDATA siblings
      const importDataBlocks = asArray(
        body?.["IMPORTDATA"] as Record<string, unknown> | Record<string, unknown>[] | undefined
      );
      for (const importData of importDataBlocks) {
        const requestData = (importData as Record<string, unknown>)?.["REQUESTDATA"] as
          | Record<string, unknown>
          | undefined;
        collectMessages(requestData);
      }

      const dataBlocks = asArray(
        body?.["DATA"] as Record<string, unknown> | Record<string, unknown>[] | undefined
      );
      for (const data of dataBlocks) {
        collectMessages(data as Record<string, unknown>);
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

  // ── Phase 1: Build ledger → group map from LEDGER records ─────────────────
  // When the XML contains LEDGER definitions (e.g. Master.xml or combined
  // export), we extract each ledger's PARENT group. This allows accurate
  // AccountCode resolution for voucher entries that reference these ledgers.
  const ledgerGroupMap = new Map<string, string>();
  for (const rawMsg of allMessages) {
    const m = rawMsg as Record<string, unknown>;
    if (!m["LEDGER"]) continue;
    const ledger = m["LEDGER"] as Record<string, unknown>;
    const name = String(ledger["NAME"] ?? ledger["@_NAME"] ?? "").trim();
    const parent = String(ledger["PARENT"] ?? "").trim();
    if (name && parent) {
      ledgerGroupMap.set(name, parent);
    }
  }

  // ── Phase 2: Process party masters and vouchers ───────────────────────────
  for (let i = 0; i < allMessages.length; i++) {
    const msg = allMessages[i] as Record<string, unknown>;

    // ── Ledger master ──────────────────────────────────────────────────────
    if (msg["LEDGER"]) {
      const ledger = msg["LEDGER"] as Record<string, unknown>;
      const name = String(ledger["NAME"] ?? ledger["@_NAME"] ?? "").trim();
      const parent = String(ledger["PARENT"] ?? "").trim();
      if (!name) continue;

      // Only extract Sundry Debtors / Creditors as party masters
      if (parent !== "Sundry Debtors" && parent !== "Sundry Creditors") continue;
      const openingBalance = parseAmount(ledger["OPENINGBALANCE"]);

      const rawGstin = ledger["PARTYGSTIN"];
      const gstin = typeof rawGstin === "string" && rawGstin.trim().length >= 15
        ? rawGstin.trim()
        : null;

      let address: string | null = null;
      const addrList = ledger["ADDRESS.LIST"] as Record<string, unknown> | undefined;
      if (addrList) {
        const addrVal = addrList["ADDRESS"];
        if (typeof addrVal === "string") {
          address = addrVal.trim() || null;
        } else if (Array.isArray(addrVal)) {
          address = addrVal.map(String).join(", ").trim() || null;
        }
      }

      partyMasters.push({
        name,
        group: parent as "Sundry Debtors" | "Sundry Creditors",
        openingBalance,
        gstin,
        address,
      });
      continue;
    }

    // ── Voucher ──────────────────────────────────────────────────────────────
    if (!msg["VOUCHER"]) continue;
    const v = msg["VOUCHER"] as Record<string, unknown>;

    const typeName = String(v["VOUCHERTYPENAME"] ?? v["@_VCHTYPE"] ?? "").trim();
    // Case-insensitive lookup (native Tally vs HisaabKitaab exports)
    const upperTypeName = typeName.toUpperCase();
    let voucherType: "SALES" | "PURCHASE" | "RECEIPT" | "PAYMENT" | "JOURNAL" | undefined = undefined;

    for (const [key, val] of Object.entries(VOUCHER_TYPE_MAP)) {
      if (key.toUpperCase() === upperTypeName) {
        voucherType = val;
        break;
      }
    }

    // Heuristic fallback for custom voucher type names (e.g. "GST Sales Voucher")
    if (!voucherType) {
      for (const [match, val] of Object.entries(VCH_HEURISTIC)) {
        if (upperTypeName.includes(match)) {
          voucherType = val;
          break;
        }
      }
    }

    if (!voucherType) {
      if (upperTypeName.includes("SALE")) voucherType = "SALES";
      else if (upperTypeName.includes("PURCHASE")) voucherType = "PURCHASE";
    }

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
    const partyLedgerName =
      String(v["PARTYLEDGERNAME"] ?? "").trim() ||
      String(v["BASICBUYERNAME"] ?? "").trim() ||
      String(v["BASICBASEPARTYNAME"] ?? "").trim() ||
      null;

    // Extract Tally's REMOTEID / GUID for idempotent re-import.
    // HisaabKitaab exports prefix the journal entry ID with "HisaabKitaab-";
    // strip the prefix so we store only the raw UUID for DB lookup.
    // Native Tally exports may have a GUID without our prefix — store as-is.
    const rawRemoteId =
      String(v["REMOTEID"] ?? v["GUID"] ?? "").trim() || null;
    const remoteId = rawRemoteId
      ? rawRemoteId.replace(/^HisaabKitaab-/i, "")
      : null;

    // Support both ALLLEDGERENTRIES.LIST (HisaabKitaab exports) and
    // LEDGERENTRIES.LIST (native Tally DayBook / daybook exports)
    const rawEntries = v["ALLLEDGERENTRIES.LIST"] ?? v["LEDGERENTRIES.LIST"];
    const entryList = asArray(rawEntries as Record<string, unknown> | Record<string, unknown>[] | undefined);

    const lines: ParsedLedgerLine[] = [];
    for (const entry of entryList) {
      const e = entry as Record<string, unknown>;
      const ledgerName = String(e["LEDGERNAME"] ?? "").trim();
      if (!ledgerName) continue;

      const amountRaw = parseAmount(e["AMOUNT"]);
      const isDeemedPositive =
        String(e["ISDEEMEDPOSITIVE"] ?? "").trim().toLowerCase() === "yes";

      // ISDEEMEDPOSITIVE is the authoritative side indicator in TallyPrime XML.
      // ISDEEMEDPOSITIVE=Yes → debit side; No → credit side (take abs of amount).
      const absAmount = Math.abs(amountRaw);
      const isDebit = isDeemedPositive;
      const debit = isDebit ? absAmount : 0;
      const credit = isDebit ? 0 : absAmount;

      if (absAmount === 0) continue;

      // ── AccountCode resolution chain ──────────────────────────────────────
      // 1. Exact match in LEDGER_TO_CODE (HisaabKitaab exports + common Tally names)
      // 2. Group-based: use PARENT from LEDGER records in the same XML
      // 3. Pattern-based: heuristic on the ledger name itself
      // 4. Fallback: infer from voucher type (assumes unknown name is a party)
      const exactCode = LEDGER_TO_CODE[ledgerName];
      const groupCode = !exactCode && ledgerGroupMap.has(ledgerName)
        ? resolveFromTallyGroup(ledgerGroupMap.get(ledgerName)!, ledgerName)
        : null;
      const patternCode = !exactCode && !groupCode
        ? resolveAccountCodeByPattern(ledgerName)
        : null;
      const accountCode: AccountCode =
        exactCode ?? groupCode ?? patternCode ?? FALLBACK_BY_VOUCHER[voucherType] ?? "SUNDRY_DEBTORS";

      const isResolvedAsKnownAccount = !!(exactCode || groupCode || patternCode);

      const billAllocName = extractBillAllocationName(e);

      // Party name resolution:
      // - Unknown ledger (fell through to fallback) AND resolved to party account
      //   → the ledger name itself IS the party (native Tally naming convention)
      // - Exact-match to a party account code (e.g. HisaabKitaab "Sundry Debtors")
      //   → use voucher-level PARTYLEDGERNAME or BILLALLOCATIONS
      // - Non-party account → null
      const partyName =
        (!isResolvedAsKnownAccount && isPartyAccountCode(accountCode))
          ? ledgerName
          : isPartyAccountCode(accountCode)
            ? partyLedgerName ?? (billAllocName && billAllocName !== reference ? billAllocName : null)
            : null;

      lines.push({ ledgerName, accountCode, partyName, debit, credit });
    }

    if (lines.length === 0) {
      parseErrors.push(
        `Message ${i + 1}: voucher "${reference}" has no ledger entries, skipping`
      );
      continue;
    }

    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);

    // PLACEOFSUPPLY: Tally writes the English state name; reverse-lookup to 2-digit code.
    const rawPlaceOfSupply = String(v["PLACEOFSUPPLY"] ?? "").trim() || null;
    const placeOfSupply = rawPlaceOfSupply
      ? stateNameToGstCode(rawPlaceOfSupply) ?? rawPlaceOfSupply
      : null;

    // GSTDETAILS.LIST: nested inside ledger entries.
    let parsedTaxPercent: number | null = null;
    const parsedHsnCodes: string[] = [];
    const seenHsn = new Set<string>();
    for (const entry of entryList) {
      const e = entry as Record<string, unknown>;
      const gstDetails = e["GSTDETAILS.LIST"];
      if (!gstDetails) continue;
      const gstList = Array.isArray(gstDetails) ? gstDetails : [gstDetails];
      for (const gst of gstList) {
        const g = gst as Record<string, unknown>;
        if (parsedTaxPercent === null) {
          const rate = parseFloat(String(g["TAXRATE"] ?? g["BASICTAXRATE"] ?? ""));
          if (!isNaN(rate) && rate > 0) parsedTaxPercent = rate;
        }
        const hsn = String(g["HSNCODE"] ?? "").trim();
        if (hsn && !seenHsn.has(hsn)) {
          seenHsn.add(hsn);
          parsedHsnCodes.push(hsn);
        }
      }
    }

    // Determine isInterState from ledger names.
    const ledgerNames = lines.map((l) => l.ledgerName.toUpperCase());
    const hasIgst = ledgerNames.some((n) => n.includes("IGST"));
    const hasCgstSgst = ledgerNames.some((n) => n.includes("CGST") || n.includes("SGST"));
    const isInterState = hasIgst ? true : hasCgstSgst ? false : null;

    vouchers.push({
      voucherType,
      originalTypeName: typeName,
      entryDate,
      reference,
      narration,
      lines,
      totalDebit,
      remoteId,
      placeOfSupply,
      taxPercent: parsedTaxPercent,
      hsnCodes: parsedHsnCodes,
      isInterState,
    });
  }

  return { vouchers, partyMasters, parseErrors };
}
