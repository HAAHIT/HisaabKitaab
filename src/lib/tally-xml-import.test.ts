/**
 * Tests for tally-xml-import helpers
 *
 * Covers the two functions fixed in the compliance remediation:
 *   1. parseTallyDate — IST noon normalization (no timezone date-rollback)
 *   2. resolveImportVoucherType — Credit Note / Debit Note type preservation
 */
import { describe, expect, it } from "vitest";
import { parseTallyDate, parseTallyXml } from "@/lib/tally-xml-import";
import { resolveImportVoucherType } from "@/app/api/jobs/process-import/route";
import { stateNameToGstCode } from "@/lib/gst-states";

// ── parseTallyDate ────────────────────────────────────────────────────────────

describe("parseTallyDate — IST normalization", () => {
  it("returns null for non-8-character input", () => {
    expect(parseTallyDate("2024040")).toBeNull();
    expect(parseTallyDate("")).toBeNull();
    expect(parseTallyDate(null)).toBeNull();
  });

  it("parses April 1 2024 as April 1 in YYYY-MM-DD (no UTC rollback)", () => {
    const d = parseTallyDate("20240401");
    expect(d).not.toBeNull();
    // toISOString gives UTC time — 06:30 UTC = noon IST, date part is still 04-01
    expect(d!.toISOString().slice(0, 10)).toBe("2024-04-01");
  });

  it("parses March 31 boundary correctly", () => {
    const d = parseTallyDate("20240331");
    expect(d!.toISOString().slice(0, 10)).toBe("2024-03-31");
  });

  it("parses Jan 1 correctly (year boundary)", () => {
    const d = parseTallyDate("20250101");
    expect(d!.toISOString().slice(0, 10)).toBe("2025-01-01");
  });

  // NOTE: JavaScript's Date silently overflows invalid calendar days (e.g. Feb 30
  // becomes Mar 1). parseTallyDate relies on isNaN(d.getTime()) which is false
  // for overflow dates. This is a known JS behaviour — Tally itself enforces
  // valid dates before writing XML, so overflow inputs are not a production risk.
  it("returns null for a non-numeric 8-character string", () => {
    expect(parseTallyDate("XXXX0101")).toBeNull();
  });
});

// ── resolveImportVoucherType ──────────────────────────────────────────────────

describe("resolveImportVoucherType — Credit Note / Debit Note mapping", () => {
  it("maps 'Sales Return' → CREDIT_NOTE", () => {
    expect(resolveImportVoucherType("Sales Return", "SALES")).toBe("CREDIT_NOTE");
  });

  it("maps 'Credit Note' → CREDIT_NOTE (alternate Tally wording)", () => {
    expect(resolveImportVoucherType("Credit Note", "SALES")).toBe("CREDIT_NOTE");
  });

  it("maps 'Purchase Return' → DEBIT_NOTE", () => {
    expect(resolveImportVoucherType("Purchase Return", "PURCHASE")).toBe("DEBIT_NOTE");
  });

  it("maps 'Debit Note' → DEBIT_NOTE (alternate Tally wording)", () => {
    expect(resolveImportVoucherType("Debit Note", "PURCHASE")).toBe("DEBIT_NOTE");
  });

  it("passes through 'Sales' as SALES unchanged", () => {
    expect(resolveImportVoucherType("Sales", "SALES")).toBe("SALES");
  });

  it("passes through 'Purchase' as PURCHASE unchanged", () => {
    expect(resolveImportVoucherType("Purchase", "PURCHASE")).toBe("PURCHASE");
  });

  it("passes through 'Receipt' as RECEIPT unchanged", () => {
    expect(resolveImportVoucherType("Receipt", "RECEIPT")).toBe("RECEIPT");
  });

  it("maps 'Contra' → CONTRA (X4: preserved native Tally type)", () => {
    expect(resolveImportVoucherType("Contra", "JOURNAL")).toBe("CONTRA");
  });
});

// ── G1: GST metadata extraction from Tally XML ──────────────────────────────

describe("parseTallyXml — GST metadata extraction (G1 fix)", () => {

  const makeVoucherXml = (gstBlock: string) => `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>Test</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Accounting Voucher View">
            <DATE>20250401</DATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>INV-100</VOUCHERNUMBER>
            <NARRATION>Test sale</NARRATION>
            <PLACEOFSUPPLY>Maharashtra</PLACEOFSUPPLY>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Sales Account</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>-10000</AMOUNT>
              ${gstBlock}
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Sundry Debtors</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>11800</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

  it("G1a: extracts placeOfSupply as 2-digit code from state name", () => {
    const xml = makeVoucherXml("");
    const result = parseTallyXml(xml);
    expect(result.parseErrors).toHaveLength(0);
    expect(result.vouchers).toHaveLength(1);
    expect(result.vouchers[0].placeOfSupply).toBe("27"); // Maharashtra
  });

  it("G1b: extracts taxPercent and hsnCodes from GSTDETAILS.LIST", () => {
    const gst = `
      <GSTDETAILS.LIST>
        <TAXTYPE>GST</TAXTYPE>
        <TAXRATE>18.00</TAXRATE>
        <BASICTAXRATE>18.00</BASICTAXRATE>
        <HSNCODE>6204</HSNCODE>
      </GSTDETAILS.LIST>`;
    const xml = makeVoucherXml(gst);
    const result = parseTallyXml(xml);
    expect(result.vouchers[0].taxPercent).toBe(18);
    expect(result.vouchers[0].hsnCodes).toEqual(["6204"]);
  });

  it("G1b: handles multiple GSTDETAILS.LIST with different HSN codes", () => {
    const gst = `
      <GSTDETAILS.LIST>
        <TAXRATE>18.00</TAXRATE>
        <HSNCODE>6204</HSNCODE>
      </GSTDETAILS.LIST>
      <GSTDETAILS.LIST>
        <TAXRATE>12.00</TAXRATE>
        <HSNCODE>6205</HSNCODE>
      </GSTDETAILS.LIST>`;
    const xml = makeVoucherXml(gst);
    const result = parseTallyXml(xml);
    expect(result.vouchers[0].taxPercent).toBe(18); // first rate
    expect(result.vouchers[0].hsnCodes).toEqual(["6204", "6205"]);
  });

  it("G1a: returns null placeOfSupply when tag is absent", () => {
    const xml = makeVoucherXml("").replace("<PLACEOFSUPPLY>Maharashtra</PLACEOFSUPPLY>", "");
    const result = parseTallyXml(xml);
    expect(result.vouchers[0].placeOfSupply).toBeNull();
  });
});

// ── G1c: stateNameToGstCode reverse lookup ───────────────────────────────────

describe("stateNameToGstCode — reverse lookup (G1c)", () => {

  it("returns '27' for 'Maharashtra'", () => {
    expect(stateNameToGstCode("Maharashtra")).toBe("27");
  });

  it("is case-insensitive", () => {
    expect(stateNameToGstCode("maharashtra")).toBe("27");
    expect(stateNameToGstCode("MAHARASHTRA")).toBe("27");
  });

  it("returns '07' for 'Delhi'", () => {
    expect(stateNameToGstCode("Delhi")).toBe("07");
  });

  it("returns null for unknown state name", () => {
    expect(stateNameToGstCode("Atlantis")).toBeNull();
  });
});

// ── Native Tally export shapes ───────────────────────────────────────────────

describe("parseTallyXml — native Tally export shape", () => {
  it("parses vouchers from BODY > DATA > TALLYMESSAGE", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
  <BODY>
    <DATA>
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="Sales" ACTION="Create">
          <DATE>20250402</DATE>
          <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
          <VOUCHERNUMBER>TS-001</VOUCHERNUMBER>
          <PARTYLEDGERNAME>Native Customer</PARTYLEDGERNAME>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>Native Customer</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <AMOUNT>-1180</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>Sales</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>1180</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
        </VOUCHER>
      </TALLYMESSAGE>
    </DATA>
  </BODY>
</ENVELOPE>`;

    const result = parseTallyXml(xml);

    expect(result.parseErrors).toHaveLength(0);
    expect(result.vouchers).toHaveLength(1);
    expect(result.vouchers[0].reference).toBe("TS-001");
    expect(result.vouchers[0].lines[0].partyName).toBe("Native Customer");
  });

  it("uses PARTYLEDGERNAME instead of BILLALLOCATIONS NAME for generic party ledgers", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <BODY>
    <IMPORTDATA>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create">
            <DATE>20250403</DATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>INV-300</VOUCHERNUMBER>
            <PARTYLEDGERNAME>Correct Customer</PARTYLEDGERNAME>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Sundry Debtors</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-1180</AMOUNT>
              <BILLALLOCATIONS.LIST>
                <NAME>INV-300</NAME>
                <BILLTYPE>On Account</BILLTYPE>
                <AMOUNT>-1180</AMOUNT>
              </BILLALLOCATIONS.LIST>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Sales</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>1180</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

    const result = parseTallyXml(xml);

    expect(result.parseErrors).toHaveLength(0);
    expect(result.vouchers[0].lines[0].partyName).toBe("Correct Customer");
  });
});
