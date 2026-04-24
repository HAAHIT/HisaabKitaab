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

/**
 * Maps Tally's voucher type name strings (both HisaabKitaab exports and
 * native TallyPrime exports) to our internal VoucherType enum values.
 *
 * [FIX-P0] Added GST return types so native Tally exports with
 * "Sales Return" / "Credit Note" / "Purchase Return" / "Debit Note" are
 * no longer dropped with parse errors.
 *
 * Mapping rationale:
 *   "Sales Return" / "Credit Note" → SALES  (reversal detected by narration
 *       / voucherType at journal-write time, consistent with existing
 *       legacy-narration path for CREDIT_NOTE promotion)
 *   "Purchase Return" / "Debit Note" → PURCHASE  (symmetric)
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
  "Sales Return": "SALES",    // Credit Note (GSTR-1 Table 9B)
  "Credit Note": "SALES",    // alt wording used by some Tally versions
  "Purchase Return": "PURCHASE", // Debit Note (GSTR-3B)
  "Debit Note": "PURCHASE",   // alt wording
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
}

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
  // ── GST metadata (G1 fix) ───────────────────────────────────────────────────
  /** 2-digit GST state code reverse-looked up from Tally's state name. Null when absent. */
  placeOfSupply: string | null;
  /** First tax rate found in GSTDETAILS.LIST (e.g. 18). Null when absent. */
  taxPercent: number | null;
  /** HSN/SAC codes extracted from GSTDETAILS.LIST HSNCODE tags. */
  hsnCodes: string[];
  /**
   * [G2] True if ledger entries contain IGST-related accounts (indicating inter-state supply).
   * Determined by scanning ledger names for "IGST" vs "CGST"/"SGST" keywords.
   * Null when no GST ledger entries are present (e.g. exempt supplies).
   */
  isInterState: boolean | null;
  /**
   * For Sales/Purchase vouchers, the raw stock-wise rows.
   * Key names match standard HisaabKitaab template columns (Item, Qty, Rate, Amount).
   */
  inventoryRows?: Record<string, any>[];
  /**
   * [FIX #12] Hash-based fingerprint for idempotency when no REMOTEID is present.
   * Generated from (date + reference + totalDebit + narration + lineCount).
   */
  fingerprint: string;
};

export type ParsedPartyMaster = {
  name: string;
  group: "Sundry Debtors" | "Sundry Creditors";
  openingBalance: number;
  /** [W-X3] GSTIN extracted from Tally's <PARTYGSTIN> tag. Null when absent. */
  gstin: string | null;
  /** [W-X3] Address extracted from Tally's <ADDRESS.LIST> tag. Null when absent. */
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

  // [FIX #15] Explicitly validate month and day bounds to catch malformed Tally dates
  if (monthRaw < 1 || monthRaw > 12 || day < 1 || day > 31) return null;

  const month = monthRaw - 1;
  // 06:30 UTC = 12:00 noon IST — date string is unambiguous in every timezone
  const d = new Date(Date.UTC(year, month, day, 6, 30, 0));
  return isNaN(d.getTime()) ? null : d;
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
  // Importable HisaabKitaab XML uses BODY > IMPORTDATA > REQUESTDATA.
  // Native Tally exports commonly use BODY > DATA > TALLYMESSAGE, and some
  // exports wrap LEDGER/VOUCHER nodes directly in BODY > DATA > COLLECTION.
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

    // fast-xml-parser may produce an array of ENVELOPEs for concatenated XML declarations
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

      // [W-X3] Extract GSTIN from <PARTYGSTIN> tag (native Tally exports)
      const rawGstin = ledger["PARTYGSTIN"];
      const gstin = typeof rawGstin === "string" && rawGstin.trim().length >= 15
        ? rawGstin.trim()
        : null;

      // [W-X3] Extract address from <ADDRESS.LIST> → <ADDRESS> (may be string or array)
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

    // Heuristic fallback for custom voucher type names
    if (!voucherType) {
      for (const [match, val] of Object.entries(VCH_HEURISTIC)) {
        if (upperTypeName.includes(match)) {
          voucherType = val;
          break;
        }
      }
    }

    if (!voucherType) {
      // Final fallback: check for any Sales/Purchase substrings
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

      // Reconstruct debit/credit from ISDEEMEDPOSITIVE and signed AMOUNT.
      //
      // ISDEEMEDPOSITIVE is the authoritative side indicator in TallyPrime XML.
      // We must NOT use the sign of AMOUNT to infer the side — on reversal
      // vouchers, Tally can emit ISDEEMEDPOSITIVE=Yes with a negative AMOUNT,
      // which the old `isDeemedPositive || amountRaw > 0` incorrectly treated
      // as two independent indicators.  The correct rule:
      //   ISDEEMEDPOSITIVE=Yes → debit side  (amount is always positive abs value)
      //   ISDEEMEDPOSITIVE=No  → credit side (amount may be negative — take abs)
      const absAmount = Math.abs(amountRaw);
      const isDebit = isDeemedPositive; // sole authority: ISDEEMEDPOSITIVE
      const debit = isDebit ? absAmount : 0;
      const credit = isDebit ? 0 : absAmount;

      if (absAmount === 0) continue;

      const resolvedCode = LEDGER_TO_CODE[ledgerName];
      // Unknown ledger name = treat as party ledger; infer group from voucher type
      const accountCode: AccountCode =
        resolvedCode ?? FALLBACK_BY_VOUCHER[voucherType] ?? "SUNDRY_DEBTORS";

      // BILLALLOCATIONS.LIST > NAME is the bill/outstanding reference in Tally,
      // not reliably the party name. Prefer PARTYLEDGERNAME for generic party
      // ledgers, and use the ledger name itself for native exports where the
      // party ledger is named directly.
      const billAllocName = extractBillAllocationName(e);
      const partyName =
        resolvedCode === undefined
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

    // ── Extract GST metadata from voucher (G1 fix) ──────────────────────────
    // PLACEOFSUPPLY: Tally writes the English state name; reverse-lookup to 2-digit code.
    const rawPlaceOfSupply = String(v["PLACEOFSUPPLY"] ?? "").trim() || null;
    const placeOfSupply = rawPlaceOfSupply
      ? stateNameToGstCode(rawPlaceOfSupply) ?? rawPlaceOfSupply // keep raw if unknown
      : null;

    // GSTDETAILS.LIST: nested inside ALLLEDGERENTRIES.LIST entries.
    // Extract first TAXRATE and all HSNCODE values.
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

    // [G2] Determine isInterState from ledger names.
    // IGST ledger entries indicate inter-state; CGST/SGST indicate intra-state.
    const ledgerNames = lines.map((l) => l.ledgerName.toUpperCase());
    const hasIgst = ledgerNames.some((n) => n.includes("IGST"));
    const hasCgstSgst = ledgerNames.some((n) => n.includes("CGST") || n.includes("SGST"));
    const isInterState = hasIgst ? true : hasCgstSgst ? false : null;

    // ── Extract Inventory entries (new!) ──────────────────────────────────────
    const rawInv = v["ALLINVENTORYENTRIES.LIST"] ?? v["INVENTORYENTRIES.LIST"];
    const invList = asArray(rawInv as Record<string, unknown> | Record<string, unknown>[] | undefined);
    const inventoryRows: Record<string, any>[] = [];

    for (const inv of invList) {
      const i = inv as Record<string, unknown>;
      const stockItemName = String(i["STOCKITEMNAME"] ?? "").trim();
      if (!stockItemName) continue;

      const qtyStr = String(i["BILLEDQTY"] ?? i["ACTUALQTY"] ?? "0").trim();
      // Split "5 Nos" -> qty: 5, unit: "Nos"
      const qtyMatch = qtyStr.match(/^([\d.-]+)\s*(.*)$/);
      const qty = qtyMatch ? parseFloat(qtyMatch[1]) : 0;
      const unit = qtyMatch ? qtyMatch[2].trim() : "";

      const rateStr = String(i["RATE"] ?? "").trim();
      const rateMatch = rateStr.match(/^([\d.-]+)/);
      const rate = rateMatch ? parseFloat(rateMatch[1]) : 0;

      const amount = Math.abs(parseAmount(i["AMOUNT"]));

      // Store in standard column keys
      inventoryRows.push({
        Item: stockItemName,
        Qty: qty,
        Unit: unit,
        Rate: rate || (qty !== 0 ? amount / qty : amount),
        Amount: amount,
      });
    }

    // [FIX #12] Generate a stable fingerprint for this voucher.
    // This allows the importer to detect duplicates even for native Tally exports 
    // that don't have a stable GUID/REMOTEID, preventing duplicate journal entries.
    const fingerprintSource = [
      entryDate.toISOString().slice(0, 10),
      reference,
      totalDebit.toFixed(2),
      narration,
      lines.length,
    ].join("|");
    // Simple non-cryptographic hash for fingerprinting
    const fingerprint = Array.from(fingerprintSource).reduce(
      (hash, char) => (hash << 5) - hash + char.charCodeAt(0),
      0
    ).toString(36);

    vouchers.push({
      voucherType,
      originalTypeName: typeName,
      entryDate,
      reference,
      narration,
      lines,
      totalDebit,
      remoteId,
      fingerprint,
      placeOfSupply,
      taxPercent: parsedTaxPercent,
      hsnCodes: parsedHsnCodes,
      isInterState,
      inventoryRows: inventoryRows.length > 0 ? inventoryRows : undefined,
    });
  }

  return { vouchers, partyMasters, parseErrors };
}
