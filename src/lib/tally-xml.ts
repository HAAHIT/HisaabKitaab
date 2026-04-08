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

/**
 * Map a database voucher type identifier to the corresponding Tally voucher type.
 *
 * @param voucherType - Database voucher type key (lookup is case-sensitive; expected keys like `SALES`, `PURCHASE`, `RECEIPT`, etc.)
 * @returns The matching `TallyVoucherType`. Returns `"Journal"` when the input has no mapped value.
 */
export function dbVoucherTypeToTally(voucherType: string): TallyVoucherType {
  return VOUCHER_TYPE_MAP[voucherType] ?? "Journal";
}

/**
 * Format a Date into Tally's YYYYMMDD string using the Asia/Kolkata timezone.
 *
 * @param date - The date to format (interpreted in the Asia/Kolkata timezone)
 * @returns The formatted date string in `YYYYMMDD` (year, two-digit month, two-digit day)
 */

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

/**
 * Escape XML special characters in a value and return the result as a string.
 *
 * @param value - The value to escape; `null` or `undefined` produces an empty string
 * @returns The input converted to a string with `&`, `<`, `>`, `"` and `'` replaced by their XML entities; `""` if `value` is `null` or `undefined`
 */

function escapeXml(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Format a numeric amount as a two-decimal string using its absolute value.
 *
 * @returns A string containing the absolute value of `amount` formatted with two decimal places (e.g., `"123.45"`).
 */
function formatAmount(amount: number): string {
  return Math.abs(amount).toFixed(2);
}

// ── JournalLine → TallyLedgerEntry conversion ────────────────────────────────

/**
 * Convert a journal row with separate debit and credit amounts into a Tally ledger entry using Tally's signed-amount convention.
 *
 * @param line - Object with `accountName`, `debit`, `credit`, and optional `partyName`
 * @returns A `TallyLedgerEntry` whose `ledgerName` is `accountName`, whose `amount` is positive for a debit or negative for a credit, and whose `partyName` is forwarded from the input when present
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

/**
 * Builds the XML block for a single Tally ledger entry.
 *
 * @param entry - Ledger entry where `ledgerName` is the ledger label, `amount` uses Tally sign convention (positive = debit, negative = credit), and optional `partyName` will be included as a bill allocation when present.
 * @returns A string containing an `<ALLLEDGERENTRIES.LIST>` XML block representing the ledger entry (including an optional `<BILLALLOCATIONS.LIST>` when `partyName` is provided).
 */

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

/**
 * Builds a Tally-compatible XML `<TALLYMESSAGE>` block for a voucher.
 *
 * @param voucher - Voucher data including date, voucherType, reference, narration, and ledgerEntries
 * @returns A string containing a `<TALLYMESSAGE>` wrapper with a `<VOUCHER>` element and its ledger entries
 */
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

/**
 * Builds a Tally-compatible XML `<TALLYMESSAGE>` containing a `<LEDGER>` definition for the supplied party.
 *
 * The returned XML includes the ledger name, parent group, and conditionally includes:
 * - an `<OPENINGBALANCE>` element when `party.openingBalance !== 0` (negative values are emitted with a leading `-` and amounts are formatted to two decimals),
 * - GST fields (`<GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE>` and `<PARTYGSTIN>`) when `party.gstin` is truthy,
 * - an `<ADDRESS.LIST>` block when `party.address` is truthy.
 *
 * @param party - The party/ledger master data. `name` and `group` are required; `openingBalance`, `gstin`, and `address` control optional XML elements as described.
 * @returns A string containing the `<TALLYMESSAGE>` XML for creating the ledger in Tally.
 */
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
 * Produce a complete Tally ENVELOPE XML containing the provided `<TALLYMESSAGE>` blocks.
 *
 * @param messages - Array of serialized `<TALLYMESSAGE>` XML blocks to include inside `<REQUESTDATA>`
 * @param companyName - Company name to place in `<SVCURRENTCOMPANY>`; the value will be XML-escaped
 * @returns A string containing the full Tally `<ENVELOPE>` XML with the messages inserted into `<REQUESTDATA>`
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
 * Builds a complete Tally XML envelope containing the provided vouchers for import.
 *
 * @param vouchers - The vouchers to serialize into the envelope
 * @param companyName - The company name used in the envelope's <SVCURRENTCOMPANY> element
 * @returns A string containing a complete Tally XML envelope ready for import, with one <TALLYMESSAGE> block per voucher
 */
export function buildTallyVoucherXml(
  vouchers: TallyVoucher[],
  companyName: string
): string {
  const messages = vouchers.map(buildVoucherXml);
  return buildEnvelope(messages, companyName);
}

/**
 * Generate a Tally-importable XML document containing one or more party (ledger) master definitions.
 *
 * @param parties - Array of party master objects to serialize into `<TALLYMESSAGE>` ledger blocks
 * @param companyName - Company name to place into the Tally envelope's `<SVCURRENTCOMPANY>` tag
 * @returns The complete Tally `<ENVELOPE>` XML string containing the serialized party master messages
 */
export function buildTallyPartyMasterXml(
  parties: TallyPartyMaster[],
  companyName: string
): string {
  const messages = parties.map(buildPartyMasterXml);
  return buildEnvelope(messages, companyName);
}
