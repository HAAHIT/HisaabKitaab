import type { ColumnDef } from "@/lib/formula";
import { roundTo2 } from "@/lib/journal-reporting";

export interface TaxSlabSummary {
    rate: number;
    hsnCode: string;
    taxableValue: number;
    cgst: number;
    sgst: number;
    igst: number;
    totalTax: number;
}

export function aggregateTaxByRate(
    rows: Record<string, string | number>[],
    columns: ColumnDef[],
    isInterState: boolean,
    billLevelTax: { subtotal: number; taxAmount: number; taxPercent: number; hsnCode: string | null }
): TaxSlabSummary[] {
    const taxPctCol = columns.find((c) => {
        const ln = c.name.toLowerCase();
        return (
            (ln.includes("tax") && (ln.includes("%") || ln.includes("pct") || ln.includes("rate"))) ||
            c.id === "col_tax_pct" ||
            c.id === "_taxPercent"
        );
    });

    const taxAmtCol = columns.find((c) => {
        const ln = c.name.toLowerCase();
        return (
            (ln.includes("tax") && (ln.includes("amount") || ln.includes("amt"))) ||
            (c.type === "formula" && ln.includes("tax"))
        );
    });

    const hsnCol = columns.find((c) => {
        const ln = c.name.toLowerCase();
        return ln.includes("hsn") || ln.includes("sac") || c.id === "col_hsn" || c.id === "_hsnCode";
    });

    const taxableCol = columns.find((c) => {
        const ln = c.name.toLowerCase();
        return (
            (c.type === "formula" || c.type === "number") &&
            (ln.includes("total") || ln.includes("amount")) &&
            !ln.includes("tax")
        );
    });

    if (!taxPctCol) {
        return [
            {
                rate: billLevelTax.taxPercent || 0,
                hsnCode: billLevelTax.hsnCode || "—",
                taxableValue: billLevelTax.subtotal,
                cgst: isInterState ? 0 : roundTo2(billLevelTax.taxAmount / 2),
                sgst: isInterState ? 0 : roundTo2(billLevelTax.taxAmount / 2),
                igst: isInterState ? billLevelTax.taxAmount : 0,
                totalTax: billLevelTax.taxAmount,
            },
        ];
    }

    const slabMap = new Map<number, TaxSlabSummary>();

    for (const row of rows) {
        const rate = typeof row[taxPctCol.id] === "number"
            ? (row[taxPctCol.id] as number)
            : parseFloat(String(row[taxPctCol.id] || "0")) || 0;

        const taxAmt = taxAmtCol
            ? (typeof row[taxAmtCol.id] === "number"
                ? (row[taxAmtCol.id] as number)
                : parseFloat(String(row[taxAmtCol.id] || "0")) || 0)
            : 0;

        const taxable = taxableCol
            ? (typeof row[taxableCol.id] === "number"
                ? (row[taxableCol.id] as number)
                : parseFloat(String(row[taxableCol.id] || "0")) || 0)
            : 0;

        const hsn = hsnCol
            ? String(row[hsnCol.id] || "—")
            : billLevelTax.hsnCode || "—";

        const existing = slabMap.get(rate);
        if (existing) {
            existing.taxableValue = roundTo2(existing.taxableValue + taxable);
            existing.totalTax = roundTo2(existing.totalTax + taxAmt);
            if (isInterState) {
                existing.igst = roundTo2(existing.igst + taxAmt);
            } else {
                existing.cgst = roundTo2(existing.cgst + roundTo2(taxAmt / 2));
                existing.sgst = roundTo2(existing.sgst + roundTo2(taxAmt / 2));
            }
            if (hsn !== "—" && existing.hsnCode !== hsn && !existing.hsnCode.includes(hsn)) {
                existing.hsnCode += `, ${hsn}`;
            }
        } else {
            slabMap.set(rate, {
                rate,
                hsnCode: hsn,
                taxableValue: taxable,
                cgst: isInterState ? 0 : roundTo2(taxAmt / 2),
                sgst: isInterState ? 0 : roundTo2(taxAmt / 2),
                igst: isInterState ? taxAmt : 0,
                totalTax: taxAmt,
            });
        }
    }

    return Array.from(slabMap.values()).sort((a, b) => a.rate - b.rate);
}
