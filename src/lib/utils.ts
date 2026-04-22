/**
 * Format a number as Indian currency (₹)
 * e.g. 46291 → "₹46,291"
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a date in readable format
 * e.g. "21 Mar 2026"
 */
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

/**
 * Format a date with time
 * e.g. "21 Mar 2026, 2:30 PM"
 */
export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date));
}

/**
 * Generate a random password of given length
 */
export function generateRandomPassword(length: number = 8): string {
  const chars =
    "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  let password = "";
  for (let i = 0; i < length; i++) {
    // Security: use crypto.getRandomValues instead of Math.random
    const randomValue = crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000;
    password += chars.charAt(Math.floor(randomValue * chars.length));
  }
  return password;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

/**
 * Generate bill number: BILL-YYYYMM-NNN
 */
export function generateBillNumber(
  prefix: string,
  existingCount: number
): string {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const serial = String(existingCount + 1).padStart(3, "0");
  return `${prefix}-${yearMonth}-${serial}`;
}

/**
 * Classnames helper (simple cn utility)
 */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}
