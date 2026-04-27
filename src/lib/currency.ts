/**
 * Shared currency formatting and rounding utilities.
 * Centralises the INR formatting logic duplicated across bill/note components.
 */

/**
 * Round a number to exactly 2 decimal places.
 * Avoids JavaScript floating-point drift (e.g. 0.1 + 0.2 ≠ 0.3).
 */
export function roundToTwo(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Format a number as Indian Rupee currency string.
 * @example formatCurrency(1234.5) → "₹1,234.50"
 */
export function formatCurrency(value: number): string {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
    }).format(value);
}

/**
 * Format a number as Indian Rupee without decimals.
 * @example formatCurrencyShort(1234) → "₹1,234"
 */
export function formatCurrencyShort(value: number): string {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(value);
}

export { numberToIndianWords } from "./number-to-words";
