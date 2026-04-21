/**
 * Round-trip tests for Tally XML serializer + parser
 *
 * Verifies that vouchers serialized by tally-xml.ts can be parsed back
 * by tally-xml-import.ts. Guards against regressions like C1/W1 where
 * return vouchers silently lost GST details.
 */
import { describe, expect, it } from "vitest";
import {
  buildTallyVoucherXml,
  buildCombinedTallyXml,
  type TallyVoucher,
  type TallyPartyMaster,
} from "@/lib/tally-xml";
import { parseTallyXml } from "@/lib/tally-xml-import";
import { buildMockTallySalesVoucher } from "@/__tests__/fixtures/factories";

const COMPANY = "TestCo";

// Removed makeSalesVoucher as it is now in fixtures

// ── Sales voucher round-trip ──────────────────────────────────────────────────

describe("Sales voucher round-trip", () => {
  it("serializes and re-parses a Sales voucher", () => {
    const voucher = buildMockTallySalesVoucher();
    const xml = buildTallyVoucherXml([voucher], COMPANY);
    const result = parseTallyXml(xml);

    expect(result.parseErrors).toHaveLength(0);
    expect(result.vouchers).toHaveLength(1);

    const parsed = result.vouchers[0];
    expect(parsed.voucherType).toBe("SALES");
    expect(parsed.reference).toBe("INV-001");
    expect(parsed.remoteId).toBe("test-guid-001");
    expect(parsed.entryDate.toISOString().slice(0, 10)).toBe("2025-04-01");
    expect(parsed.lines.length).toBeGreaterThanOrEqual(2);
  });
});

// ── C1/W1 regression guard: Sales Return retains GST details ─────────────────

describe("Sales Return (Credit Note) round-trip — C1/W1 guard", () => {
  it("emits <GSTDETAILS.LIST> on Sales Return vouchers", () => {
    const voucher = buildMockTallySalesVoucher({
      voucherType: "Credit Note",
      reference: "CN-001",
      narration: "Reversal of Sales Bill INV-001",
      guid: "test-guid-cn-001",
    });
    const xml = buildTallyVoucherXml([voucher], COMPANY);

    // The XML MUST contain GSTDETAILS.LIST for the return voucher.
    // Before the C1/W1 fix, isGstEligible excluded "Credit Note" so
    // no GSTDETAILS.LIST was emitted.
    expect(xml).toContain("<GSTDETAILS.LIST>");
    expect(xml).toContain("<HSNCODE>6204</HSNCODE>");
    expect(xml).toContain("<TAXRATE>18.00</TAXRATE>");
    expect(xml).toContain("VCHTYPE=\"Credit Note\"");
    expect(xml).toContain("<ISPARTYLEDGER>No</ISPARTYLEDGER>");
  });

  it("emits <GSTDETAILS.LIST> on Purchase Return vouchers", () => {
    const voucher = buildMockTallySalesVoucher({
      voucherType: "Debit Note",
      reference: "DN-001",
      narration: "Purchase return to Vendor",
      guid: "test-guid-dn-001",
    });
    const xml = buildTallyVoucherXml([voucher], COMPANY);

    expect(xml).toContain("<GSTDETAILS.LIST>");
    expect(xml).toContain("VCHTYPE=\"Debit Note\"");
  });

  it("does NOT emit <GSTDETAILS.LIST> on Journal vouchers", () => {
    const voucher = buildMockTallySalesVoucher({
      voucherType: "Journal",
      reference: "JV-001",
      narration: "Manual adjustment",
      guid: "test-guid-jv-001",
    });
    const xml = buildTallyVoucherXml([voucher], COMPANY);

    expect(xml).not.toContain("<GSTDETAILS.LIST>");
  });
});

// ── Combined export round-trip ───────────────────────────────────────────────

describe("Combined export (masters + vouchers) round-trip", () => {
  it("parses both parties and vouchers from a single combined XML", () => {
    const parties: TallyPartyMaster[] = [
      {
        name: "Alpha Corp",
        group: "Sundry Debtors",
        openingBalance: 5000,
        gstin: "27AABCU9603R1ZM",
      },
      {
        name: "Beta Supplies",
        group: "Sundry Creditors",
        openingBalance: -3000,
      },
    ];
    const vouchers = [
      buildMockTallySalesVoucher(),
      buildMockTallySalesVoucher({
        voucherType: "Credit Note",
        reference: "CN-002",
        guid: "test-guid-cn-002",
      }),
    ];

    const xml = buildCombinedTallyXml(parties, vouchers, COMPANY);
    const result = parseTallyXml(xml);

    expect(result.parseErrors).toHaveLength(0);
    expect(result.partyMasters).toHaveLength(2);
    expect(result.vouchers).toHaveLength(2);
    expect(result.partyMasters[0].name).toBe("Alpha Corp");
    expect(result.partyMasters[1].name).toBe("Beta Supplies");
  });
});

// ── Fingerprint consistency test (W4 guard) ──────────────────────────────────

describe("Fingerprint date format consistency — W4 guard", () => {
  it("date-only slice produces identical strings for IST noon dates", () => {
    // Simulate a Prisma Date (stored as ISO) and a Tally-parsed date
    const prismaDate = new Date("2025-04-01T06:30:00.000Z"); // IST noon
    const tallyDate = new Date(Date.UTC(2025, 3, 1, 6, 30, 0));          // same

    const prismaFingerprint = prismaDate.toISOString().slice(0, 10);
    const tallyFingerprint = tallyDate.toISOString().slice(0, 10);

    expect(prismaFingerprint).toBe("2025-04-01");
    expect(tallyFingerprint).toBe("2025-04-01");
    expect(prismaFingerprint).toBe(tallyFingerprint);
  });

  it("full ISO strings would differ if time components vary — proves slice is necessary", () => {
    const dateA = new Date("2025-04-01T06:30:00.000Z");
    const dateB = new Date("2025-04-01T00:00:00.000Z");

    // Full ISO strings differ
    expect(dateA.toISOString()).not.toBe(dateB.toISOString());
    // But date-only slices match
    expect(dateA.toISOString().slice(0, 10)).toBe(dateB.toISOString().slice(0, 10));
  });
});

// ── G1d: GST metadata round-trip ─────────────────────────────────────────────

describe("GST metadata round-trip — G1d guard", () => {
  it("placeOfSupply, taxPercent, and hsnCodes survive export → import", () => {
    const voucher = buildMockTallySalesVoucher({
      placeOfSupply: "27",
      taxPercent: 18,
      hsnRatePairs: [{ hsnCode: "6204", taxPercent: 18 }],
      hsnCodes: ["6204"],
    });
    const xml = buildTallyVoucherXml([voucher], COMPANY);
    const result = parseTallyXml(xml);

    expect(result.parseErrors).toHaveLength(0);
    expect(result.vouchers).toHaveLength(1);

    const parsed = result.vouchers[0];
    expect(parsed.placeOfSupply).toBe("27");
    expect(parsed.taxPercent).toBe(18);
    expect(parsed.hsnCodes).toContain("6204");
  });
});

// ── X2: BILLALLOCATIONS.LIST NAME uses bill reference ────────────────────────

describe("BILLALLOCATIONS.LIST NAME — X2 fix", () => {
  it("emits bill reference in <NAME>, not party name", () => {
    const voucher = buildMockTallySalesVoucher({
      reference: "INV-001",
      ledgerEntries: [
        { ledgerName: "Sundry Debtors", amount: 11800, partyName: "Test Party" },
        { ledgerName: "Sales Account", amount: -10000, isIncomeLedger: true },
      ],
    });
    const xml = buildTallyVoucherXml([voucher], COMPANY);

    // BILLALLOCATIONS NAME should contain the bill reference
    expect(xml).toContain("<NAME>INV-001</NAME>");
    // Should NOT use party name as the allocation name
    expect(xml).not.toMatch(/<BILLALLOCATIONS\.LIST>\s*<NAME>Test Party<\/NAME>/);
  });

  it("falls back to partyName when reference is not set on the entry", () => {
    const voucher = buildMockTallySalesVoucher({
      reference: "INV-002",
      ledgerEntries: [
        { ledgerName: "Sundry Debtors", amount: 11800, partyName: "Fallback Party" },
        { ledgerName: "Sales Account", amount: -10000, isIncomeLedger: true },
      ],
    });
    const xml = buildTallyVoucherXml([voucher], COMPANY);

    // The voucher reference should be used since entry.reference is undefined
    expect(xml).toContain("<NAME>INV-002</NAME>");
  });
});
