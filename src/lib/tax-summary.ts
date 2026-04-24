/**
 * Tax Summary Helper
 * Aggregates per-row tax data from bill line items into a per-slab
 * breakdown suitable for statutory print layouts and GSTR-1 HSN summary.
 */

import type { ColumnDef } from "@/lib/formula";

export interface TaxSlabSummary {
    rate: number;        // e.g. 18
    hsnCode: string;     // e.g. "6201" or "—"
    taxableValue: number;
    cgst: number;        // 0 if inter-state
    sgst: number;        // 0 if inter-state
    igst: number;        // 0 if intra-state
    totalTax: number;
}

/**
 * Scans bill rows for tax-related columns and groups by tax rate.
 *
 * Column detection heuristics:
 * - Tax %:     column name contains "tax" AND "%" OR id matches "col_tax_pct" / "_taxPercent"
 * - Tax Amt:   column name contains "tax" AND ("amount" | "amt") OR type=formula with "tax" in name
 * - HSN:       column name contains "hsn" or "sac" OR id matches "_hsnCode" / "col_hsn"
 * - Taxable:   column name contains "total" OR "amount" (the formula/number before tax)
 *
 * Falls back to bill-level tax when per-row data is unavailable.
 */
export function aggregateTaxByRate(
    rows: Record<string, string | number>[],
    columns: ColumnDef[],
    isInterState: boolean,
    billLevelTax: { subtotal: number; taxAmount: number; taxPercent: number; hsnCode: string | null }
): TaxSlabSummary[] {
    // Detect column IDs by heuristic name matching
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

    // Try to find each row's taxable value (the line total before tax)
    const taxableCol = columns.find((c) => {
        const ln = c.name.toLowerCase();
        return (
            (c.type === "formula" || c.type === "number") &&
            (ln.includes("total") || ln.includes("amount")) &&
            !ln.includes("tax")
        );
    });

    // If we don't have per-row tax % data, return bill-level fallback
    if (!taxPctCol) {
        return [
            {
                rate: billLevelTax.taxPercent || 0,
                hsnCode: billLevelTax.hsnCode || "—",
                taxableValue: billLevelTax.subtotal,
                cgst: isInterState ? 0 : Math.round((billLevelTax.taxAmount / 2) * 100) / 100,
                sgst: isInterState ? 0 : Math.round((billLevelTax.taxAmount / 2) * 100) / 100,
                igst: isInterState ? billLevelTax.taxAmount : 0,
                totalTax: billLevelTax.taxAmount,
            },
        ];
    }

    // Aggregate per-rate
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
            existing.taxableValue += taxable;
            existing.totalTax += taxAmt;
            if (isInterState) {
                existing.igst += taxAmt;
            } else {
                existing.cgst += Math.round((taxAmt / 2) * 100) / 100;
                existing.sgst += Math.round((taxAmt / 2) * 100) / 100;
            }
            // Merge HSN — if different, concatenate
            if (hsn !== "—" && existing.hsnCode !== hsn && !existing.hsnCode.includes(hsn)) {
                existing.hsnCode += `, ${hsn}`;
            }
        } else {
            slabMap.set(rate, {
                rate,
                hsnCode: hsn,
                taxableValue: taxable,
                cgst: isInterState ? 0 : Math.round((taxAmt / 2) * 100) / 100,
                sgst: isInterState ? 0 : Math.round((taxAmt / 2) * 100) / 100,
                igst: isInterState ? taxAmt : 0,
                totalTax: taxAmt,
            });
        }
    }

    // Sort by rate ascending
    return Array.from(slabMap.values()).sort((a, b) => a.rate - b.rate);
}
