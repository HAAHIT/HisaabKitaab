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
