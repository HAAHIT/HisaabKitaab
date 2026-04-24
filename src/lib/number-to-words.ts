/**
 * Convert a number to Indian-English words for invoicing.
 * E.g. 1234.50 → "One Thousand Two Hundred Thirty-Four Rupees and Fifty Paise Only"
 */

const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
];
const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

function twoDigits(n: number): string {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? "-" + ones[n % 10] : "");
}

function convertChunk(n: number): string {
    if (n === 0) return "";
    if (n < 100) return twoDigits(n);
    return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + twoDigits(n % 100) : "");
}

export function numberToIndianWords(amount: number): string {
    if (amount === 0) return "Zero Rupees Only";

    const absAmount = Math.abs(amount);
    const rupees = Math.floor(absAmount);
    const paise = Math.round((absAmount - rupees) * 100);

    let result = "";

    if (rupees > 0) {
        // Indian numbering: Crore, Lakh, Thousand, Hundred
        const crore = Math.floor(rupees / 10000000);
        const lakh = Math.floor((rupees % 10000000) / 100000);
        const thousand = Math.floor((rupees % 100000) / 1000);
        const remainder = rupees % 1000;

        const parts: string[] = [];
        if (crore > 0) parts.push(convertChunk(crore) + " Crore");
        if (lakh > 0) parts.push(convertChunk(lakh) + " Lakh");
        if (thousand > 0) parts.push(convertChunk(thousand) + " Thousand");
        if (remainder > 0) parts.push(convertChunk(remainder));

        result = parts.join(" ") + " Rupees";
    }

    if (paise > 0) {
        result += (rupees > 0 ? " and " : "") + convertChunk(paise) + " Paise";
    }

    return (amount < 0 ? "Minus " : "") + result + " Only";
}
