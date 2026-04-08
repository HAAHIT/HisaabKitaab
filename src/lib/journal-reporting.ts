const INDIA_TIMEZONE = "Asia/Kolkata";
const INDIA_OFFSET = "+05:30";

/**
 * Round a number to two decimal places.
 *
 * @param value - The numeric input to round
 * @returns The input rounded to two decimal places
 */
export function roundTo2(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Escape a value for safe inclusion in a CSV field.
 *
 * @param value - The string or number to escape; numbers are converted to a string
 * @returns The CSV-escaped string: if the value contains a comma, double quote, or newline it is wrapped in double quotes and internal quotes are doubled (`"` → `""`), otherwise the plain stringified value
 */
export function escapeCsv(value: string | number) {
  const text = String(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

/**
 * Format a Date as `DD/MM/YYYY` in the India timezone for CSV output.
 *
 * @param date - The date to format
 * @returns The formatted date string in `DD/MM/YYYY` using the "Asia/Kolkata" timezone
 */
export function formatDateForCsv(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: INDIA_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/**
 * Formats a date for use in HTML date inputs using the India timezone (Asia/Kolkata).
 *
 * @param date - The date to format (interpreted in the India timezone)
 * @returns A string in `YYYY-MM-DD` format suitable for an input value, adjusted to Asia/Kolkata
 */
export function formatDateForInput(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Create start and end Date objects for a date range interpreted in the India timezone, covering the full days.
 *
 * @param from - Start date string in `YYYY-MM-DD` format
 * @param to - End date string in `YYYY-MM-DD` format
 * @returns An object with `fromDate` set to the start of `from` (00:00:00.000 IST) and `toDate` set to the end of `to` (23:59:59.999 IST)
 * @throws Error("Invalid date range") if either input cannot be parsed as a valid date
 * @throws Error("From date must be on or before the to date") if the start date is later than the end date
 */
export function parseIndianDateRange(from: string, to: string) {
  const fromDate = new Date(`${from}T00:00:00.000${INDIA_OFFSET}`);
  const toDate = new Date(`${to}T23:59:59.999${INDIA_OFFSET}`);

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    throw new Error("Invalid date range");
  }

  if (fromDate.getTime() > toDate.getTime()) {
    throw new Error("From date must be on or before the to date");
  }

  return { fromDate, toDate };
}

/**
 * Calculate the Indian financial year label and its start/end dates that contain the given reference date.
 *
 * @param referenceDate - Date used to determine the financial year; defaults to the current date
 * @returns An object with:
 *  - `label`: the financial year label (e.g., `FY 2024-25`)
 *  - `from`: start date of the financial year in `YYYY-04-01` format
 *  - `to`: end date of the financial year in `YYYY-03-31` format
 */
export function getCurrentFinancialYearRange(referenceDate = new Date()) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const startYear = month >= 3 ? year : year - 1;
  const endYear = startYear + 1;

  return {
    label: `FY ${startYear}-${String(endYear).slice(-2)}`,
    from: `${startYear}-04-01`,
    to: `${endYear}-03-31`,
  };
}

/**
 * Determine the financial quarter label and its start/end dates for a given reference date.
 *
 * The quarters follow the Indian financial-year mapping: Q1 = Apr–Jun, Q2 = Jul–Sep, Q3 = Oct–Dec, Q4 = Jan–Mar.
 *
 * @param referenceDate - Date used to determine the quarter (defaults to current date)
 * @returns An object with `label` (e.g., `"Q1"`), `from` (start date in `YYYY-MM-DD`), and `to` (end date in `YYYY-MM-DD`)
 */
export function getCurrentQuarterRange(referenceDate = new Date()) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();

  if (month >= 3 && month <= 5) {
    return { label: "Q1", from: `${year}-04-01`, to: `${year}-06-30` };
  }

  if (month >= 6 && month <= 8) {
    return { label: "Q2", from: `${year}-07-01`, to: `${year}-09-30` };
  }

  if (month >= 9 && month <= 11) {
    return { label: "Q3", from: `${year}-10-01`, to: `${year}-12-31` };
  }

  const startYear = month <= 2 ? year - 1 : year;
  return { label: "Q4", from: `${startYear + 1}-01-01`, to: `${startYear + 1}-03-31` };
}
