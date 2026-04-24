import { describe, it, expect } from "vitest";
import { aggregateTaxByRate } from "./tax-summary";
import type { ColumnDef } from "./formula";

const billLevelDefaults = {
    subtotal: 10000,
    taxAmount: 1800,
    taxPercent: 18,
    hsnCode: "6201",
};

describe("aggregateTaxByRate", () => {
    it("falls back to bill-level when no tax % column exists", () => {
        const columns: ColumnDef[] = [
            { id: "col_item", name: "Item", type: "text", position: 0 },
            { id: "col_rate", name: "Rate", type: "number", position: 1 },
        ];
        const rows = [{ col_item: "Widget", col_rate: 10000 }];

        const result = aggregateTaxByRate(rows, columns, false, billLevelDefaults);

        expect(result).toHaveLength(1);
        expect(result[0].rate).toBe(18);
        expect(result[0].hsnCode).toBe("6201");
        expect(result[0].cgst).toBe(900);
        expect(result[0].sgst).toBe(900);
        expect(result[0].igst).toBe(0);
        expect(result[0].totalTax).toBe(1800);
    });

    it("falls back to IGST for inter-state bill-level", () => {
        const columns: ColumnDef[] = [
            { id: "col_item", name: "Item", type: "text", position: 0 },
        ];
        const rows = [{ col_item: "Widget" }];

        const result = aggregateTaxByRate(rows, columns, true, billLevelDefaults);

        expect(result[0].cgst).toBe(0);
        expect(result[0].sgst).toBe(0);
        expect(result[0].igst).toBe(1800);
    });

    it("groups by tax rate when per-row tax % column exists", () => {
        const columns: ColumnDef[] = [
            { id: "col_item", name: "Item", type: "text", position: 0 },
            { id: "col_amount", name: "Amount", type: "number", position: 1 },
            { id: "col_tax_pct", name: "Tax %", type: "number", position: 2 },
            { id: "col_tax_amt", name: "Tax Amount", type: "formula", formula: "{col_amount} * {col_tax_pct} / 100", position: 3 },
        ];

        const rows = [
            { col_item: "Widget A", col_amount: 5000, col_tax_pct: 18, col_tax_amt: 900 },
            { col_item: "Widget B", col_amount: 3000, col_tax_pct: 18, col_tax_amt: 540 },
            { col_item: "Widget C", col_amount: 2000, col_tax_pct: 5, col_tax_amt: 100 },
        ];

        const result = aggregateTaxByRate(rows, columns, false, billLevelDefaults);

        expect(result).toHaveLength(2);

        // Sorted by rate ascending
        const slab5 = result.find((s) => s.rate === 5)!;
        const slab18 = result.find((s) => s.rate === 18)!;

        expect(slab5.taxableValue).toBe(2000);
        expect(slab5.totalTax).toBe(100);
        expect(slab5.cgst).toBe(50);
        expect(slab5.sgst).toBe(50);

        expect(slab18.taxableValue).toBe(8000);
        expect(slab18.totalTax).toBe(1440);
    });

    it("uses per-row HSN codes when available", () => {
        const columns: ColumnDef[] = [
            { id: "col_item", name: "Item", type: "text", position: 0 },
            { id: "col_amount", name: "Amount", type: "number", position: 1 },
            { id: "col_tax_pct", name: "Tax %", type: "number", position: 2 },
            { id: "col_tax_amt", name: "Tax Amount", type: "formula", formula: "", position: 3 },
            { id: "col_hsn", name: "HSN Code", type: "text", position: 4 },
        ];

        const rows = [
            { col_item: "Shirt", col_amount: 5000, col_tax_pct: 12, col_tax_amt: 600, col_hsn: "6109" },
            { col_item: "Pants", col_amount: 3000, col_tax_pct: 12, col_tax_amt: 360, col_hsn: "6204" },
        ];

        const result = aggregateTaxByRate(rows, columns, false, billLevelDefaults);

        expect(result).toHaveLength(1);
        expect(result[0].hsnCode).toContain("6109");
        expect(result[0].hsnCode).toContain("6204");
    });

    it("handles zero-tax rows gracefully", () => {
        const columns: ColumnDef[] = [
            { id: "col_item", name: "Item", type: "text", position: 0 },
            { id: "col_amount", name: "Amount", type: "number", position: 1 },
            { id: "col_tax_pct", name: "Tax %", type: "number", position: 2 },
            { id: "col_tax_amt", name: "Tax Amount", type: "formula", formula: "", position: 3 },
        ];

        const rows = [
            { col_item: "Exempt Item", col_amount: 1000, col_tax_pct: 0, col_tax_amt: 0 },
            { col_item: "Taxed Item", col_amount: 2000, col_tax_pct: 18, col_tax_amt: 360 },
        ];

        const result = aggregateTaxByRate(rows, columns, false, billLevelDefaults);

        expect(result).toHaveLength(2);
        expect(result[0].rate).toBe(0);
        expect(result[0].totalTax).toBe(0);
        expect(result[1].rate).toBe(18);
        expect(result[1].totalTax).toBe(360);
    });
});
