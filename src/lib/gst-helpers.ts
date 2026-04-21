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

/**
 * Validates whether a GSTIN string matches the official 15-character format.
 * Returns true if the GSTIN is structurally valid.
 * Does NOT perform Verhoeff check digit verification.
 */
export function isValidGstinFormat(gstin: string): boolean {
  return GSTIN_REGEX.test(gstin.toUpperCase().trim());
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
