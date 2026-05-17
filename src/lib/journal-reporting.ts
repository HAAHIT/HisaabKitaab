const INDIA_TIMEZONE = "Asia/Kolkata";
const INDIA_OFFSET = "+05:30";

export function roundTo2(value: number) {
  return Math.round(value * 100) / 100;
}

/** Nearest-Rupee rounding for GSTR-3B filing-level totals (per Tally convention). */
export function roundToRupee(value: number): number {
  return Math.round(value);
}

export function escapeCsv(value: string | number) {
  const text = String(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function formatDateForCsv(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: INDIA_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatDateForInput(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

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
 * Returns the calendar year/month/day of `referenceDate` as seen in IST.
 * Use this anywhere server-local `getMonth()`/`getFullYear()` would otherwise
 * be wrong by up to 5h30m on a UTC host — financial year boundaries, monthly
 * report ranges, bill-number prefixes, etc.
 *
 * `month` is 0-indexed to match `Date.getMonth()`.
 */
export function getIstCalendar(
  referenceDate: Date
): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: INDIA_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(referenceDate);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value) - 1;
  const day = Number(parts.find((p) => p.type === "day")?.value);
  return { year, month, day };
}

function getIstYearMonth(referenceDate: Date): { year: number; month: number } {
  const { year, month } = getIstCalendar(referenceDate);
  return { year, month };
}

/**
 * Returns a UTC Date instant equal to IST midnight on the given calendar day.
 * IST = UTC+05:30, so IST midnight = the previous day's 18:30 UTC.
 */
export function istMidnightUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, -5, -30, 0, 0));
}

export function getCurrentFinancialYearRange(referenceDate = new Date()) {
  const { year, month } = getIstYearMonth(referenceDate);
  const startYear = month >= 3 ? year : year - 1;
  const endYear = startYear + 1;

  return {
    label: `FY ${startYear}-${String(endYear).slice(-2)}`,
    from: `${startYear}-04-01`,
    to: `${endYear}-03-31`,
  };
}

export function getCurrentQuarterRange(referenceDate = new Date()) {
  const { year, month } = getIstYearMonth(referenceDate);

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
