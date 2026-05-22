export function roundToTwo(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatCurrency(value: number): string {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

export function formatCurrencyShort(value: number): string {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(value);
}

export { numberToIndianWords } from "./number-to-words";
