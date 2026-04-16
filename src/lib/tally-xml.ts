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
 */

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
};

export function dbVoucherTypeToTally(voucherType: string): TallyVoucherType {
  return VOUCHER_TYPE_MAP[voucherType] ?? "Journal";
}

/**
 * Determines whether a journal entry should be exported as "Sales Return"
 * (Credit Note) instead of the generic "Journal" type.
 * Detection rule: narration starts with the prefix written by
 * journalForCancelledSalesBill() in journal.ts.
 */
export function resolveExportVoucherType(
  dbVoucherType: string,
  narration: string
): TallyVoucherType {
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
 */
export function journalLineToTallyEntry(line: {
  accountName: string;
  debit: number;
  credit: number;
  partyName?: string | null;
}): TallyLedgerEntry {
  const amount = line.debit > 0 ? line.debit : -line.credit;
  return {
    ledgerName: line.accountName,
    amount,
    partyName: line.partyName,
  };
}

// ── XML builders ─────────────────────────────────────────────────────────────

function buildLedgerEntryXml(entry: TallyLedgerEntry): string {
  const billAllocations =
    entry.partyName
      ? `
        <BILLALLOCATIONS.LIST>
          <NAME>${escapeXml(entry.partyName)}</NAME>
          <BILLTYPE>On Account</BILLTYPE>
          <AMOUNT>${entry.amount >= 0 ? "" : "-"}${formatAmount(entry.amount)}</AMOUNT>
        </BILLALLOCATIONS.LIST>`
      : "";

  return `
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${escapeXml(entry.ledgerName)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>${entry.amount >= 0 ? "Yes" : "No"}</ISDEEMEDPOSITIVE>
        <AMOUNT>${entry.amount >= 0 ? "" : "-"}${formatAmount(entry.amount)}</AMOUNT>${billAllocations}
      </ALLLEDGERENTRIES.LIST>`;
}

function buildVoucherXml(voucher: TallyVoucher): string {
  const ledgerLines = voucher.ledgerEntries.map(buildLedgerEntryXml).join("");

  // GUID prevents duplicate imports on re-import (TallyPrime idempotency).
  // Format: "HisaabKitaab-{uuid}" keeps the namespace distinct from native Tally GUIDs.
  const guidTag = voucher.guid
    ? `
        <GUID>HisaabKitaab-${escapeXml(voucher.guid)}</GUID>
        <REMOTEID>HisaabKitaab-${escapeXml(voucher.guid)}</REMOTEID>`
    : "";

  return `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <VOUCHER VCHTYPE="${escapeXml(voucher.voucherType)}" ACTION="Create" OBJVIEW="Accounting Voucher View">${guidTag}
        <DATE>${formatTallyDate(voucher.date)}</DATE>
        <VOUCHERTYPENAME>${escapeXml(voucher.voucherType)}</VOUCHERTYPENAME>
        <VOUCHERNUMBER>${escapeXml(voucher.reference)}</VOUCHERNUMBER>
        <NARRATION>${escapeXml(voucher.narration)}</NARRATION>${ledgerLines}
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

  return `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <LEDGER NAME="${escapeXml(party.name)}" ACTION="Create">
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
