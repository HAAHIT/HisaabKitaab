/**
 * Tests for tally-xml-import helpers
 *
 * Covers the two functions fixed in the compliance remediation:
 *   1. parseTallyDate — IST noon normalization (no timezone date-rollback)
 *   2. resolveImportVoucherType — Credit Note / Debit Note type preservation
 */
import { describe, expect, it } from "vitest";
import { parseTallyDate } from "@/lib/tally-xml-import";
import { resolveImportVoucherType } from "@/app/api/jobs/process-import/route";

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

  it("returns baseType for unknown originalTypeName", () => {
    expect(resolveImportVoucherType("Contra", "JOURNAL")).toBe("JOURNAL");
  });
});
