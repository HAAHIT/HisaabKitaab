/**
 * Tally XML serializer
 *
 * Produces XML compatible with Tally ERP 9 and Tally Prime import.
 *
 * Format reference (TallyPrime 4.x import spec):
 *   ENVELOPE > HEADER > BODY > IMPORTDATA > REQUESTDESC + REQUESTDATA
 *
 * REPORTNAME dispatch rules (critical):
 *   - "All Masters"  → Tally processes <LEDGER> nodes only
 *   - "Vouchers"     → Tally processes <VOUCHER> nodes only
 *   Combined exports require TWO separate <IMPORTDATA> blocks in one <ENVELOPE>.
 *
 * Amount convention (Tally):
 *   DEBIT  = positive amount, ISDEEMEDPOSITIVE=Yes
 *   CREDIT = negative amount, ISDEEMEDPOSITIVE=No
 *
 * Dates: YYYYMMDD in IST (Asia/Kolkata).
 *
 * GST fields added (per TallyPrime 4.x GST spec):
 *   <PLACEOFSUPPLY>  — on <VOUCHER>; state name derived from 2-digit GST code
 *   <GSTDETAILS.LIST> — on Sales/Purchase <ALLLEDGERENTRIES.LIST>; carries tax rate + HSN
 */

import { gstCodeToStateName } from "@/lib/gst-states";

const INDIA_TIMEZONE = "Asia/Kolkata";

// ── Types ────────────────────────────────────────────────────────────────────

export type TallyVoucherType =
  | "Sales"
  | "Purchase"
  | "Receipt"
  | "Payment"
  | "Journal"
  | "Contra"
  | "Sales Return"    // Credit Note — required for GSTR-1 Table 9B
  | "Purchase Return"; // Debit Note — required for GSTR-3B

export interface TallyLedgerEntry {
  ledgerName: string;
  /** Positive = debit, Negative = credit (Tally convention) */
  amount: number;
  partyName?: string | null;
  /** Set to true for the Sales Account / Purchase Account line — receives GSTDETAILS.LIST */
  isIncomeLedger?: boolean;
}

export interface TallyVoucher {
  date: Date;
  voucherType: TallyVoucherType;
  /** Reference number — bill number, payment ID, etc. */
  reference: string;
  narration: string;
  ledgerEntries: TallyLedgerEntry[];
  /**
   * Stable unique ID for this voucher — used as <GUID> and <REMOTEID>.
   * Prevents duplicate entries on Tally re-import.  Pass journal entry ID.
   * Format emitted: "HisaabKitaab-{guid}"
   */
  guid?: string;
  /**
   * 2-digit GST state code (e.g. "27").  Converted to state name for Tally XML.
   * Required for GSTR-1 B2B vouchers (Table 4A).
   */
  placeOfSupply?: string | null;
  /**
   * GST rate applied to the whole bill (e.g. 18 for 18%).
   * Written into <GSTDETAILS.LIST> on the income/expense ledger entry.
   */
  taxPercent?: number | null;
  /** True = IGST; false = CGST+SGST split.  Affects <TAXTYPE> tag. */
  isInterState?: boolean;
  /**
   * Unique HSN/SAC codes found in bill rows (_hsnCode key convention).
   * Written into <GSTDETAILS.LIST> when present.
   */
  hsnCodes?: string[];
}

export interface TallyPartyMaster {
  name: string;
  /** Tally group: "Sundry Debtors" or "Sundry Creditors" */
  group: "Sundry Debtors" | "Sundry Creditors";
  openingBalance: number;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  gstin?: string | null;
}

// ── Internal DB → Tally voucher type mapping ─────────────────────────────────

const VOUCHER_TYPE_MAP: Record<string, TallyVoucherType> = {
  SALES: "Sales",
  PURCHASE: "Purchase",
  RECEIPT: "Receipt",
  PAYMENT: "Payment",
  JOURNAL: "Journal",
  CREDIT_NOTE: "Sales Return",
};

export function dbVoucherTypeToTally(voucherType: string): TallyVoucherType {
  return VOUCHER_TYPE_MAP[voucherType] ?? "Journal";
}

/**
 * Determines whether a journal entry should be exported as "Sales Return"
 * (Credit Note) instead of the generic "Journal" type.
 *
 * Primary path:  DB voucherType === "CREDIT_NOTE" → "Sales Return"
 * Legacy path:   Old entries stored as JOURNAL with the reversal narration prefix
 *                (written before the CREDIT_NOTE enum was introduced) → "Sales Return"
 */
export function resolveExportVoucherType(
  dbVoucherType: string,
  narration: string
): TallyVoucherType {
  if (dbVoucherType === "CREDIT_NOTE") {
    return "Sales Return";
  }
  // Legacy: cancellations created before CREDIT_NOTE enum existed
  if (
    dbVoucherType === "JOURNAL" &&
    narration.startsWith("Reversal of Sales Bill")
  ) {
    return "Sales Return";
  }
  return dbVoucherTypeToTally(dbVoucherType);
}

// ── Date formatting ───────────────────────────────────────────────────────────

function formatTallyDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replace(/-/g, ""); // YYYY-MM-DD → YYYYMMDD
}

// ── XML escaping ──────────────────────────────────────────────────────────────

function escapeXml(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatAmount(amount: number): string {
  return Math.abs(amount).toFixed(2);
}

// ── JournalLine → TallyLedgerEntry conversion ────────────────────────────────

/**
 * Converts a journal line (separate debit/credit columns) to Tally's
 * sign-based single-amount convention.
 * Debit = positive amount, Credit = negative amount.
 *
 * isIncomeLedger must be true for the Sales Account / Purchase Account line
 * so the serializer knows where to attach <GSTDETAILS.LIST>.
 */
export function journalLineToTallyEntry(line: {
  accountName: string;
  debit: number;
  credit: number;
  partyName?: string | null;
}): TallyLedgerEntry {
  const amount = line.debit > 0 ? line.debit : -line.credit;
  const isIncomeLedger =
    line.accountName === "Sales Account" ||
    line.accountName === "Purchase Account";
  return {
    ledgerName: line.accountName,
    amount,
    partyName: line.partyName,
    isIncomeLedger,
  };
}

// ── GST detail XML helpers ────────────────────────────────────────────────────

/**
 * Builds one <GSTDETAILS.LIST> block.
 * hsnCode is optional — omitted when the bill line has no HSN code.
 */
function buildGstDetailsXml(
  taxPercent: number,
  hsnCode?: string
): string {
  const hsnTag = hsnCode
    ? `
          <HSNCODE>${escapeXml(hsnCode)}</HSNCODE>`
    : "";

  return `
        <GSTDETAILS.LIST>
          <TAXTYPE>GST</TAXTYPE>
          <TAXRATE>${taxPercent.toFixed(2)}</TAXRATE>
          <BASICTAXRATE>${taxPercent.toFixed(2)}</BASICTAXRATE>
          <ISPARTYLEDGER>No</ISPARTYLEDGER>
          <CESS>0</CESS>${hsnTag}
          <SOURCEOFDETAILS>NotApplicable</SOURCEOFDETAILS>
        </GSTDETAILS.LIST>`;
}

// ── XML builders ─────────────────────────────────────────────────────────────

function buildLedgerEntryXml(
  entry: TallyLedgerEntry,
  gstContext?: { taxPercent: number; hsnCodes: string[] }
): string {
  const billAllocations = entry.partyName
    ? `
        <BILLALLOCATIONS.LIST>
          <NAME>${escapeXml(entry.partyName)}</NAME>
          <BILLTYPE>On Account</BILLTYPE>
          <AMOUNT>${entry.amount >= 0 ? "" : "-"}${formatAmount(entry.amount)}</AMOUNT>
        </BILLALLOCATIONS.LIST>`
    : "";

  // Attach GSTDETAILS.LIST only to the Sales/Purchase income ledger entry.
  // When multiple HSN codes exist, emit one block per code; otherwise emit one
  // block without HSNCODE (bill-level rate, no HSN breakdown).
  let gstDetails = "";
  if (entry.isIncomeLedger && gstContext && gstContext.taxPercent > 0) {
    if (gstContext.hsnCodes.length > 0) {
      gstDetails = gstContext.hsnCodes
        .map((code) => buildGstDetailsXml(gstContext.taxPercent, code))
        .join("");
    } else {
      gstDetails = buildGstDetailsXml(gstContext.taxPercent);
    }
  }

  return `
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${escapeXml(entry.ledgerName)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>${entry.amount >= 0 ? "Yes" : "No"}</ISDEEMEDPOSITIVE>
        <AMOUNT>${entry.amount >= 0 ? "" : "-"}${formatAmount(entry.amount)}</AMOUNT>${billAllocations}${gstDetails}
      </ALLLEDGERENTRIES.LIST>`;
}

function buildVoucherXml(voucher: TallyVoucher): string {
  // Build GST context from voucher-level fields (populated from Bill when available)
  const gstContext =
    voucher.taxPercent != null && voucher.taxPercent > 0
      ? { taxPercent: voucher.taxPercent, hsnCodes: voucher.hsnCodes ?? [] }
      : undefined;

  const ledgerLines = voucher.ledgerEntries
    .map((entry) => buildLedgerEntryXml(entry, gstContext))
    .join("");

  // GUID prevents duplicate imports on re-import (TallyPrime idempotency).
  const guidTag = voucher.guid
    ? `
        <GUID>HisaabKitaab-${escapeXml(voucher.guid)}</GUID>
        <REMOTEID>HisaabKitaab-${escapeXml(voucher.guid)}</REMOTEID>`
    : "";

  // PLACEOFSUPPLY: convert 2-digit GST code to English state name for Tally.
  const placeOfSupplyTag =
    voucher.placeOfSupply
      ? `
        <PLACEOFSUPPLY>${escapeXml(
          gstCodeToStateName(voucher.placeOfSupply) ?? voucher.placeOfSupply
        )}</PLACEOFSUPPLY>`
      : "";

  return `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <VOUCHER VCHTYPE="${escapeXml(voucher.voucherType)}" ACTION="Create" OBJVIEW="Accounting Voucher View">${guidTag}
        <DATE>${formatTallyDate(voucher.date)}</DATE>
        <VOUCHERTYPENAME>${escapeXml(voucher.voucherType)}</VOUCHERTYPENAME>
        <VOUCHERNUMBER>${escapeXml(voucher.reference)}</VOUCHERNUMBER>
        <NARRATION>${escapeXml(voucher.narration)}</NARRATION>${placeOfSupplyTag}${ledgerLines}
      </VOUCHER>
    </TALLYMESSAGE>`;
}

function buildPartyMasterXml(party: TallyPartyMaster): string {
  const openingBalanceFormatted =
    party.openingBalance !== 0
      ? `<OPENINGBALANCE>${party.openingBalance < 0 ? "-" : ""}${formatAmount(party.openingBalance)}</OPENINGBALANCE>`
      : "";

  const gstinField = party.gstin
    ? `<GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE>
        <PARTYGSTIN>${escapeXml(party.gstin)}</PARTYGSTIN>`
    : "";

  const addressField = party.address
    ? `<ADDRESS.LIST TYPE="String"><ADDRESS>${escapeXml(party.address)}</ADDRESS></ADDRESS.LIST>`
    : "";

  // ACTION="Alter" is idempotent in TallyPrime 3+:
  //   - Ledger does not exist → Tally creates it
  //   - Ledger exists         → Tally updates GSTIN, opening balance, address
  // ACTION="Create" silently fails on re-import of an existing ledger.
  return `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <LEDGER NAME="${escapeXml(party.name)}" ACTION="Alter">
        <NAME>${escapeXml(party.name)}</NAME>
        <PARENT>${escapeXml(party.group)}</PARENT>
        ${openingBalanceFormatted}
        ${gstinField}
        ${addressField}
      </LEDGER>
    </TALLYMESSAGE>`;
}

// ── Envelope builders ─────────────────────────────────────────────────────────
//
// CRITICAL: TallyPrime dispatches imports based on REPORTNAME:
//   "All Masters" → processes <LEDGER> elements only
//   "Vouchers"    → processes <VOUCHER> elements only
// A combined export therefore requires TWO <IMPORTDATA> blocks inside ONE
// <ENVELOPE>. Using a single block with either REPORTNAME silently drops
// whichever element type doesn't match.

function buildImportDataBlock(
  messages: string[],
  reportName: "All Masters" | "Vouchers",
  companyName: string
): string {
  return `
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>${reportName}</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>${messages.join("")}
      </REQUESTDATA>
    </IMPORTDATA>`;
}

function wrapEnvelope(importDataBlocks: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>${importDataBlocks.join("")}
  </BODY>
</ENVELOPE>`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Serializes a list of journal vouchers to a Tally-importable XML string.
 * Uses REPORTNAME="Vouchers" so TallyPrime processes <VOUCHER> elements.
 */
export function buildTallyVoucherXml(
  vouchers: TallyVoucher[],
  companyName: string
): string {
  const messages = vouchers.map(buildVoucherXml);
  const block = buildImportDataBlock(messages, "Vouchers", companyName);
  return wrapEnvelope([block]);
}

/**
 * Serializes party masters (ledger definitions) to a Tally-importable XML string.
 * Uses REPORTNAME="All Masters" so TallyPrime processes <LEDGER> elements.
 * Import this before importing vouchers so ledger names resolve correctly.
 */
export function buildTallyPartyMasterXml(
  parties: TallyPartyMaster[],
  companyName: string
): string {
  const messages = parties.map(buildPartyMasterXml);
  const block = buildImportDataBlock(messages, "All Masters", companyName);
  return wrapEnvelope([block]);
}

/**
 * Serializes both party masters and vouchers to a single Tally-importable XML
 * envelope with TWO <IMPORTDATA> blocks — masters first (REPORTNAME="All Masters"),
 * then vouchers (REPORTNAME="Vouchers").
 *
 * This is the correct combined-export format per TallyPrime 4.x import spec.
 * A single <IMPORTDATA> block with mixed types silently drops one category.
 */
export function buildCombinedTallyXml(
  parties: TallyPartyMaster[],
  vouchers: TallyVoucher[],
  companyName: string
): string {
  const masterBlock = buildImportDataBlock(
    parties.map(buildPartyMasterXml),
    "All Masters",
    companyName
  );
  const voucherBlock = buildImportDataBlock(
    vouchers.map(buildVoucherXml),
    "Vouchers",
    companyName
  );
  return wrapEnvelope([masterBlock, voucherBlock]);
}
