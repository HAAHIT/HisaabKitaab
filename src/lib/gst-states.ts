/**
 * GST State / Union Territory Codes
 *
 * Source: GSTN portal (https://www.gst.gov.in)
 * These are the official 2-digit numeric codes used in:
 *   - GSTIN (first 2 digits identify the state/UT)
 *   - GSTR-1 filing (place of supply column)
 *   - Tally XML <PLACEOFSUPPLY> tag (uses the English name derived from code)
 *
 * Storage convention:
 *   DB column  → 2-digit string code  e.g. "27"
 *   UI display → "${code} - ${name}"  e.g. "27 - Maharashtra"
 *   Tally XML  → English name only    e.g. "Maharashtra"
 *   GSTR-1 CSV → 2-digit code         e.g. "27"
 */

export const GST_STATE_CODES: Record<string, string> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  // Pre-2020 merger codes — kept for backwards-compat with GSTINs issued before
  // the Dadra & Nagar Haveli + Daman & Diu merger (Gazette Notification 26/Jan/2020).
  // GSTN continues to accept these in filings but the combined UT now uses code "26".
  "25": "Dadra and Nagar Haveli and Daman and Diu",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "28": "Andhra Pradesh",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh (Amaravati)",
  "38": "Ladakh",
  // Special codes used by GSTN for e-commerce / SEZ / other-territory supplies
  "97": "Other Territory",
  "99": "Centre",
};

/** Set of valid 2-digit GST state codes — used for O(1) Zod validation. */
export const GST_STATE_CODE_SET = new Set(Object.keys(GST_STATE_CODES));

/**
 * Returns the English state name for a 2-digit GST code.
 * Returns null if the code is not recognised.
 */
export function gstCodeToStateName(code: string): string | null {
  return GST_STATE_CODES[code] ?? null;
}

/**
 * Returns true if the supplied value is a valid 2-digit GST state code.
 */
export function isValidGstStateCode(code: string): boolean {
  return GST_STATE_CODE_SET.has(code);
}

// ── Reverse lookup: state name → 2-digit code ─────────────────────────────────
// Lazy-initialised on first call. Lowercase keys for case-insensitive matching.

let _nameToCodeMap: Map<string, string> | null = null;

function getNameToCodeMap(): Map<string, string> {
  if (!_nameToCodeMap) {
    _nameToCodeMap = new Map<string, string>();
    for (const [code, name] of Object.entries(GST_STATE_CODES)) {
      const key = name.toLowerCase();
      // First code wins — for merged UTs (25/26) the first entry is kept
      if (!_nameToCodeMap.has(key)) {
        _nameToCodeMap.set(key, code);
      }
    }
  }
  return _nameToCodeMap;
}

/**
 * Returns the 2-digit GST state code for an English state/UT name.
 * Case-insensitive. Returns null if the name is not recognised.
 *
 * Used by the Tally XML import parser to convert `<PLACEOFSUPPLY>Maharashtra</PLACEOFSUPPLY>`
 * back to the 2-digit code stored in the DB.
 */
export function stateNameToGstCode(name: string): string | null {
  return getNameToCodeMap().get(name.toLowerCase()) ?? null;
}
