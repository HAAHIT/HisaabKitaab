"use client";

import {
    Table,
    TableHeader,
    TableColumn,
    TableBody,
    TableRow,
    TableCell,
    Card,
    CardHeader,
    CardBody,
} from "@heroui/react";
import { formatCurrency } from "@/lib/currency";

/** Generic line item shape for both bill rows and journal lines */
export interface LineItem {
    /** Row label (item description or account name) */
    description: string;
    /** Optional quantity */
    quantity?: number;
    /** Optional unit price / rate */
    unitPrice?: number;
    /** Optional tax percentage */
    taxPercent?: number;
    /** Line total amount */
    total: number;
    /** For journal lines: debit amount */
    debit?: number;
    /** For journal lines: credit amount */
    credit?: number;
}

export type LineItemMode = "invoice" | "journal";

interface BillLineItemsProps {
    items: LineItem[];
    /** 'invoice' shows Qty/Rate columns, 'journal' shows Debit/Credit columns */
    mode?: LineItemMode;
    /** Optional template name */
    templateName?: string;
    /** Theme color accent */
    themeColor?: "primary" | "success" | "warning";
}

export function BillLineItems({
    items,
    mode = "invoice",
    templateName,
    themeColor = "primary",
}: BillLineItemsProps) {
    if (items.length === 0) return null;

    const accentText =
        themeColor === "success"
            ? "text-emerald-600 dark:text-emerald-400"
            : themeColor === "warning"
                ? "text-amber-600 dark:text-amber-400"
                : "text-blue-600 dark:text-blue-400";

    return (
        <Card shadow="sm" className="mb-6">
            <CardHeader className="px-6 pt-6 pb-0">
                <h2 className="font-semibold">
                    Line Items
                    {templateName && templateName !== "__QUICK_BILL__" && (
                        <span className="ml-2 text-sm font-normal text-default-400">
                            ({templateName})
                        </span>
                    )}
                </h2>
            </CardHeader>
            <CardBody className="p-6">
                {/* Desktop: Table view */}
                <div className="hidden sm:block overflow-x-auto">
                    {mode === "invoice" ? (
                        <Table
                            aria-label="Invoice line items"
                            removeWrapper
                            classNames={{
                                th: "bg-default-50 dark:bg-default-100/5 text-default-600 font-semibold text-xs uppercase tracking-wider",
                                td: "py-3",
                            }}
                        >
                            <TableHeader>
                                <TableColumn>#</TableColumn>
                                <TableColumn>Description</TableColumn>
                                <TableColumn className="text-right">Qty</TableColumn>
                                <TableColumn className="text-right">Rate</TableColumn>
                                <TableColumn className="text-right">Tax %</TableColumn>
                                <TableColumn className="text-right">Amount</TableColumn>
                            </TableHeader>
                            <TableBody>
                                {items.map((item, i) => (
                                    <TableRow key={i} className="border-b border-divider/30">
                                        <TableCell className="text-default-400 w-10">
                                            {i + 1}
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {item.description}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            {item.quantity ?? "—"}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            {item.unitPrice != null
                                                ? formatCurrency(item.unitPrice)
                                                : "—"}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            {item.taxPercent != null ? `${item.taxPercent}%` : "—"}
                                        </TableCell>
                                        <TableCell
                                            className={`text-right font-mono font-semibold ${accentText}`}
                                        >
                                            {formatCurrency(item.total)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <Table
                            aria-label="Journal line items"
                            removeWrapper
                            classNames={{
                                th: "bg-default-50 dark:bg-default-100/5 text-default-600 font-semibold text-xs uppercase tracking-wider",
                                td: "py-3",
                            }}
                        >
                            <TableHeader>
                                <TableColumn>#</TableColumn>
                                <TableColumn>Account</TableColumn>
                                <TableColumn className="text-right">Debit</TableColumn>
                                <TableColumn className="text-right">Credit</TableColumn>
                            </TableHeader>
                            <TableBody>
                                {items.map((item, i) => (
                                    <TableRow key={i} className="border-b border-divider/30">
                                        <TableCell className="text-default-400 w-10">
                                            {i + 1}
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {item.description}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            {item.debit ? formatCurrency(item.debit) : "—"}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            {item.credit ? formatCurrency(item.credit) : "—"}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>

                {/* Mobile: Card stack view */}
                <div className="sm:hidden space-y-3">
                    {items.map((item, i) => (
                        <div
                            key={i}
                            className="rounded-xl border border-divider p-3 space-y-2"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-default-100 text-xs font-medium text-default-500">
                                        {i + 1}
                                    </span>
                                    <span className="font-medium text-sm">
                                        {item.description}
                                    </span>
                                </div>
                                <span className={`font-mono font-bold text-sm ${accentText}`}>
                                    {formatCurrency(item.total)}
                                </span>
                            </div>
                            {mode === "invoice" && (
                                <div className="flex items-center gap-4 text-xs text-default-500 pl-8">
                                    {item.quantity != null && <span>Qty: {item.quantity}</span>}
                                    {item.unitPrice != null && (
                                        <span>Rate: {formatCurrency(item.unitPrice)}</span>
                                    )}
                                    {item.taxPercent != null && (
                                        <span>Tax: {item.taxPercent}%</span>
                                    )}
                                </div>
                            )}
                            {mode === "journal" && (
                                <div className="flex items-center gap-4 text-xs text-default-500 pl-8">
                                    {item.debit != null && item.debit > 0 && (
                                        <span>Dr: {formatCurrency(item.debit)}</span>
                                    )}
                                    {item.credit != null && item.credit > 0 && (
                                        <span>Cr: {formatCurrency(item.credit)}</span>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </CardBody>
        </Card>
    );
}
