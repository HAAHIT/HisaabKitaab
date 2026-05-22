"use client";

import { Card, CardBody, Divider } from "@heroui/react";
import { formatCurrency, numberToIndianWords } from "@/lib/currency";

export interface TaxSlab {
    label: string;
    amount: number;
}

export interface BillSummaryProps {
    subtotal: number;
    /** Pre-computed tax slabs to display (e.g. CGST, SGST, IGST lines) */
    taxSlabs?: TaxSlab[];
    /** Fallback: single tax line with percent + amount */
    taxPercent?: number;
    taxAmount?: number;
    roundOff?: number;
    grandTotal: number;
    /** Theme color for gradient and total */
    theme?: "primary" | "success" | "warning";
    /** Show amount in words */
    showAmountInWords?: boolean;
    /** Credit notes show in parentheses, debit notes show as +amount */
    amountStyle?: "standard" | "credit" | "debit";
}

const gradientMap = {
    primary: "from-blue-500/5 to-indigo-500/5",
    success: "from-emerald-500/5 to-green-500/5",
    warning: "from-amber-500/5 to-orange-500/5",
};

const totalColorMap = {
    primary: "text-primary",
    success: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
};

function formatGrandTotal(
    value: number,
    style: "standard" | "credit" | "debit"
): string {
    const formatted = formatCurrency(Math.abs(value));
    switch (style) {
        case "credit":
            return `(${formatted})`;
        case "debit":
            return `+${formatted}`;
        default:
            return formatted;
    }
}

export function BillSummary({
    subtotal,
    taxSlabs,
    taxPercent,
    taxAmount,
    roundOff,
    grandTotal,
    theme = "primary",
    showAmountInWords = false,
    amountStyle = "standard",
}: BillSummaryProps) {
    return (
        <Card
            shadow="sm"
            className={`bg-gradient-to-br ${gradientMap[theme]}`}
        >
            <CardBody className="p-6">
                <h3 className="text-lg font-semibold mb-4">Summary</h3>
                <div className="space-y-3 text-sm">
                    {/* Subtotal */}
                    <div className="flex justify-between">
                        <span className="text-default-500">Subtotal</span>
                        <span className="font-medium">{formatCurrency(subtotal)}</span>
                    </div>

                    {/* Tax slabs (multi-rate) */}
                    {taxSlabs && taxSlabs.length > 0
                        ? taxSlabs.map((slab, i) => (
                            <div key={i} className="flex justify-between">
                                <span className="text-default-500">{slab.label}</span>
                                <span className="font-medium">
                                    {formatCurrency(slab.amount)}
                                </span>
                            </div>
                        ))
                        : taxAmount != null && (
                            <div className="flex justify-between">
                                <span className="text-default-500">
                                    Tax{taxPercent != null ? ` (${taxPercent}%)` : ""}
                                </span>
                                <span className="font-medium">
                                    {formatCurrency(taxAmount)}
                                </span>
                            </div>
                        )}

                    {/* Round off */}
                    {roundOff != null && roundOff !== 0 && (
                        <div className="flex justify-between">
                            <span className="text-default-500">Round Off</span>
                            <span
                                className={`font-medium font-mono ${roundOff > 0 ? "text-success" : "text-danger"}`}
                            >
                                {roundOff > 0 ? "+" : ""}
                                {formatCurrency(roundOff)}
                            </span>
                        </div>
                    )}

                    <Divider />

                    {/* Grand Total */}
                    <div className="flex justify-between items-center">
                        <span className="text-xl font-bold">Grand Total</span>
                        <span className={`text-xl font-bold ${totalColorMap[theme]}`}>
                            {formatGrandTotal(grandTotal, amountStyle)}
                        </span>
                    </div>

                    {/* Amount in words */}
                    {showAmountInWords && (
                        <p className="text-xs text-default-400 italic pt-1 border-t border-divider">
                            {numberToIndianWords(grandTotal)}
                        </p>
                    )}
                </div>
            </CardBody>
        </Card>
    );
}
