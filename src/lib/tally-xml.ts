/**
 * Tally XML serializer
 *
 * Produces XML compatible with Tally ERP 9 and Tally Prime import.
 * Format: ENVELOPE > BODY > TALLYMESSAGE > VOUCHER / LEDGER
 *
 * Reference: Tally TDL XML import specification
 * Dates: YYYYMMDD in IST
 * Amounts: plain decimal, 2dp, no currency symbol
 * Tally debit/credit convention: DEBIT entries have positive amount on the
 * ledger line, CREDIT entries have negative amount (Tally uses sign-based
 * single-amount per ledger entry, not separate debit/credit columns).
 */

const INDIA_TIMEZONE = "Asia/Kolkata";

// ── Types ────────────────────────────────────────────────────────────────────

export type TallyVoucherType =
  | "Sales"
  | "Purchase"
  | "Receipt"
  | "Payment"
  | "Journal"
  | "Contra";

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

  return `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <VOUCHER VCHTYPE="${escapeXml(voucher.voucherType)}" ACTION="Create" OBJVIEW="Accounting Voucher View">
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

// ── Public: full envelope builders ───────────────────────────────────────────

/**
 * Wraps voucher and/or ledger TALLYMESSAGE blocks in a full Tally envelope.
 */
function buildEnvelope(messages: string[], companyName: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>${messages.join("")}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

/**
 * Serializes a list of journal vouchers to a Tally-importable XML string.
 */
export function buildTallyVoucherXml(
  vouchers: TallyVoucher[],
  companyName: string
): string {
  const messages = vouchers.map(buildVoucherXml);
  return buildEnvelope(messages, companyName);
}

/**
 * Serializes party masters (ledger definitions) to a Tally-importable XML string.
 * Import this before importing vouchers so ledger names resolve correctly.
 */
export function buildTallyPartyMasterXml(
  parties: TallyPartyMaster[],
  companyName: string
): string {
  const messages = parties.map(buildPartyMasterXml);
  return buildEnvelope(messages, companyName);
}
