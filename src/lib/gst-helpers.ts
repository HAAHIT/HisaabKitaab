/**
 * GST helper utilities
 *
 * Pure functions for GSTIN validation and inter-state supply detection.
 * These are intentionally kept separate from gst-states.ts to avoid
 * circular dependencies (gst-states is imported by both import and export).
 */

/**
 * Extracts the 2-digit GST state code from a 15-character GSTIN.
 * Returns null if the GSTIN is falsy or shorter than 2 characters.
 *
 * GSTIN format: SS PPPPP NNNN P E Z C
 *   SS = 2-digit state code (positions 0-1)
 */
export function extractGstinStateCode(gstin: string | null | undefined): string | null {
  if (!gstin || gstin.length < 2) return null;
  const code = gstin.slice(0, 2);
  // Must be two digits
  if (!/^\d{2}$/.test(code)) return null;
  return code;
}

/**
 * Valid GST slabs under GST 2.0.
 * Standard: 0%, 5%, 18%
 * Special: 0.25% (rough diamonds, rough precious stones), 3% (gold, silver)
 */
export const VALID_GST_SLABS = new Set([0, 0.25, 3, 5, 18]);

/**
 * GSTIN format regex:
 *   SS AAAAA NNNN A E Z C
 *   Positions 0-1:  2-digit state code (01–38)
 *   Positions 2-6:  5 alpha chars (PAN first 5)
 *   Positions 7-10: 4 digits (PAN next 4)
 *   Position 11:    1 alpha (PAN last char)
 *   Position 12:    1 alphanumeric (entity number)
 *   Position 13:    'Z' (default)
 *   Position 14:    1 alphanumeric (check digit)
 */
const GSTIN_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/;

// ── Verhoeff check-digit tables for GSTIN validation ────────────────────────
// [FIX #13] The 15th character of a GSTIN is a Verhoeff check digit.
// These lookup tables implement the Verhoeff algorithm.
const VERHOEFF_D: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6], [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const VERHOEFF_P: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2], [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];
const GSTIN_CHAR_MAP = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function verhoeffCheck(gstin: string): boolean {
  const upper = gstin.toUpperCase().trim();
  if (upper.length !== 15) return false;
  let c = 0;
  // Process characters right-to-left
  const chars = upper.split("").reverse();
  for (let i = 0; i < chars.length; i++) {
    const idx = GSTIN_CHAR_MAP.indexOf(chars[i]);
    if (idx < 0) return false;
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][idx % 10]];
  }
  return c === 0;
}

/**
 * Validates whether a GSTIN string matches the official 15-character format
 * AND passes the Verhoeff check-digit verification.
 * Returns true if the GSTIN is both structurally and arithmetically valid.
 */
export function isValidGstinFormat(gstin: string): boolean {
  const upper = gstin.toUpperCase().trim();
  if (!GSTIN_REGEX.test(upper)) return false;
  // Verhoeff check catches typos that pass the regex
  return verhoeffCheck(upper);
}

/**
 * Determines whether a transaction is inter-state based on GSTIN state codes.
 *
 * Logic (priority order):
 *   1. Both GSTINs present → compare first 2 digits. Different = inter-state.
 *   2. Only one GSTIN present → fall back to manualOverride.
 *   3. Neither present → fall back to manualOverride.
 *   4. manualOverride not provided → default false (intra-state).
 *
 * This is the canonical detection logic per IGST Act Section 7(1):
 *   "Inter-state supply = supplier and place of supply in different states."
 *
 * @param partyGstin    Customer/Vendor GSTIN (from bill or party record)
 * @param tenantGstin   Tenant's registered GSTIN (from Tenant.gstin or settings)
 * @param manualOverride  UI-provided override; used only when GSTIN comparison is impossible
 */
export function deriveIsInterState(
  partyGstin: string | null | undefined,
  tenantGstin: string | null | undefined,
  manualOverride?: boolean
): boolean {
  const partyState = extractGstinStateCode(partyGstin);
  const tenantState = extractGstinStateCode(tenantGstin);

  if (partyState && tenantState) {
    return partyState !== tenantState;
  }

  // Cannot determine from GSTIN — fall back to manual
  return manualOverride ?? false;
}
