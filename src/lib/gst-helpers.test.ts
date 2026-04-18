/**
 * Tests for gst-helpers — GSTIN state code extraction and inter-state detection
 *
 * Covers the P0 fix G-C1: auto-derive isInterState from GSTIN comparison,
 * preventing incorrect GST filing (CGST+SGST instead of IGST or vice versa).
 */
import { describe, expect, it } from "vitest";
import { extractGstinStateCode, deriveIsInterState } from "@/lib/gst-helpers";

// ── extractGstinStateCode ─────────────────────────────────────────────────────

describe("extractGstinStateCode", () => {
  it("extracts '27' from a Maharashtra GSTIN", () => {
    expect(extractGstinStateCode("27AAPFU0939F1ZV")).toBe("27");
  });

  it("extracts '09' from a UP GSTIN", () => {
    expect(extractGstinStateCode("09AAACR5055K1Z5")).toBe("09");
  });

  it("returns null for null/undefined/empty", () => {
    expect(extractGstinStateCode(null)).toBeNull();
    expect(extractGstinStateCode(undefined)).toBeNull();
    expect(extractGstinStateCode("")).toBeNull();
  });

  it("returns null for a 1-character string", () => {
    expect(extractGstinStateCode("2")).toBeNull();
  });

  it("returns null for non-digit first 2 characters", () => {
    expect(extractGstinStateCode("ABCDE12345FGHI")).toBeNull();
  });
});

// ── deriveIsInterState ────────────────────────────────────────────────────────

describe("deriveIsInterState", () => {
  // Both GSTINs present
  it("returns false when both GSTINs are same state (27)", () => {
    expect(
      deriveIsInterState("27AAPFU0939F1ZV", "27AABCU9603R1ZM")
    ).toBe(false);
  });

  it("returns true when GSTINs are different states (27 vs 09)", () => {
    expect(
      deriveIsInterState("09AAACR5055K1Z5", "27AABCU9603R1ZM")
    ).toBe(true);
  });

  it("ignores manualOverride when both GSTINs are present", () => {
    // Both same state (27) but manual says true → should still be false
    expect(
      deriveIsInterState("27AAPFU0939F1ZV", "27AABCU9603R1ZM", true)
    ).toBe(false);

    // Different states but manual says false → should still be true
    expect(
      deriveIsInterState("09AAACR5055K1Z5", "27AABCU9603R1ZM", false)
    ).toBe(true);
  });

  // One GSTIN missing
  it("falls back to manualOverride when party GSTIN is null", () => {
    expect(deriveIsInterState(null, "27AABCU9603R1ZM", true)).toBe(true);
    expect(deriveIsInterState(null, "27AABCU9603R1ZM", false)).toBe(false);
  });

  it("falls back to manualOverride when tenant GSTIN is null", () => {
    expect(deriveIsInterState("27AAPFU0939F1ZV", null, true)).toBe(true);
    expect(deriveIsInterState("27AAPFU0939F1ZV", null, false)).toBe(false);
  });

  // Neither GSTIN present
  it("defaults to false when both GSTINs null and no manual override", () => {
    expect(deriveIsInterState(null, null)).toBe(false);
  });

  it("uses manualOverride when both GSTINs null", () => {
    expect(deriveIsInterState(null, null, true)).toBe(true);
  });
});
