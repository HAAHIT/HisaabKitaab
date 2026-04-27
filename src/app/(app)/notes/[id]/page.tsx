"use client";

import { useState, useEffect, use } from "react";
import {
    Card,
    CardBody,
    CardHeader,
    Button,
    Chip,
    Skeleton,
} from "@heroui/react";
import { useRouter } from "next/navigation";
import { Printer, Download, RotateCcw, TrendingUp } from "lucide-react";
import { BillHeader } from "@/components/bills/BillHeader";
import { BillLineItems, type LineItem } from "@/components/bills/BillLineItems";
import { BillSummary } from "@/components/bills/BillSummary";
import { BillFooter } from "@/components/bills/BillFooter";
import { formatCurrency, numberToIndianWords } from "@/lib/currency";

/* ── Account code friendly labels ─────────────────────── */
const ACCOUNT_LABELS: Record<string, string> = {
    SUNDRY_DEBTORS: "Sundry Debtors",
    SUNDRY_CREDITORS: "Sundry Creditors",
    SALES: "Sales",
    PURCHASE: "Purchase",
    OUTPUT_CGST: "Output CGST",
    OUTPUT_SGST: "Output SGST",
    OUTPUT_IGST: "Output IGST",
    INPUT_CGST: "Input CGST",
    INPUT_SGST: "Input SGST",
    INPUT_IGST: "Input IGST",
};

/* ── Types ────────────────────────────────────────────── */
interface NoteLine {
    id: string;
    accountCode: string;
    debit: number;
    credit: number;
    partyId: string | null;
    partyName: string | null;
}

interface NoteDetail {
    id: string;
    entryDate: string;
    narration: string;
    voucherType: "CREDIT_NOTE" | "DEBIT_NOTE";
    grandTotal: number;
    createdAt: string;
    createdBy: string;
    originalInvoiceNo: string | null;
    reasonForIssuance: string | null;
    partyId: string | null;
    partyName: string | null;
    lines: NoteLine[];
}

/* ── Page Component ───────────────────────────────────── */
export default function NoteDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const router = useRouter();
    const { id } = use(params);
    const [note, setNote] = useState<NoteDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{
        message: string;
        type: "success" | "error";
    } | null>(null);

    function showToast(message: string, type: "success" | "error") {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    }

    useEffect(() => {
        async function loadNote() {
            try {
                const res = await fetch(`/api/credit-notes/${id}`);
                if (!res.ok) throw new Error("Failed to load note");
                const data = await res.json();
                setNote(data.note);
            } catch {
                showToast("Failed to load note details", "error");
            } finally {
                setLoading(false);
            }
        }
        loadNote();
    }, [id]);

    /* Loading state */
    if (loading) {
        return (
            <div className="p-4 lg:p-8 space-y-4 max-w-5xl mx-auto">
                <Skeleton className="h-8 w-48 rounded-lg" />
                <Skeleton className="h-40 w-full rounded-xl" />
                <Skeleton className="h-60 w-full rounded-xl" />
                <Skeleton className="h-40 w-full rounded-xl" />
            </div>
        );
    }

    /* Not found */
    if (!note) {
        return (
            <div className="p-4 lg:p-8 max-w-5xl mx-auto">
                <Card>
                    <CardBody className="text-center py-16">
                        <p className="text-lg font-medium">Note not found</p>
                        <Button
                            className="mt-3"
                            variant="flat"
                            onPress={() => router.push("/notes")}
                        >
                            Back to Notes
                        </Button>
                    </CardBody>
                </Card>
            </div>
        );
    }

    /* ── Theme derivation ─────────────────────────────── */
    const isCredit = note.voucherType === "CREDIT_NOTE";
    const theme = isCredit ? "success" : "warning";
    const documentLabel = isCredit ? "Credit Memo" : "Debit Memo";
    const ThemeIcon = isCredit ? RotateCcw : TrendingUp;

    const themeAccent = isCredit
        ? "emerald"
        : "amber";

    const watermarkColor = isCredit
        ? "text-emerald-500/[0.04] dark:text-emerald-400/[0.04]"
        : "text-amber-500/[0.04] dark:text-amber-400/[0.04]";

    /* ── Derived data ─────────────────────────────────── */
    const formattedDate = new Date(note.entryDate).toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "long",
        year: "numeric",
    });

    const partyLine = note.lines.find((l) => l.partyId);

    // Compute subtotal and tax from journal lines
    const taxLines = note.lines.filter((l) =>
        l.accountCode.includes("CGST") ||
        l.accountCode.includes("SGST") ||
        l.accountCode.includes("IGST")
    );
    const revenueLines = note.lines.filter(
        (l) => l.accountCode === "SALES" || l.accountCode === "PURCHASE"
    );
    const subtotal = revenueLines.reduce((sum, l) => sum + l.debit + l.credit, 0);
    const totalTax = taxLines.reduce((sum, l) => sum + l.debit + l.credit, 0);

    const taxSlabs = taxLines.map((l) => ({
        label: ACCOUNT_LABELS[l.accountCode] || l.accountCode,
        amount: l.debit + l.credit,
    }));

    // Convert journal lines to LineItem format
    const lineItems: LineItem[] = note.lines.map((l) => ({
        description: ACCOUNT_LABELS[l.accountCode] || l.accountCode,
        total: Math.max(l.debit, l.credit),
        debit: l.debit,
        credit: l.credit,
    }));

    return (
        <div className="p-4 lg:p-8 animate-fade-in max-w-5xl mx-auto relative">
            {/* Print styles */}
            <style jsx global>{`
        @media print {
          @page { margin: 15mm; size: auto; }
          body { background: white !important; font-size: 12pt; }
          .no-print { display: none !important; }
        }
      `}</style>

            {/* Toast */}
            {toast && (
                <div
                    className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg animate-slide-up no-print ${toast.type === "success"
                            ? "bg-success text-white"
                            : "bg-danger text-white"
                        }`}
                >
                    {toast.message}
                </div>
            )}

            {/* Watermark */}
            <div
                className={`pointer-events-none fixed inset-0 flex items-center justify-center z-0 select-none ${watermarkColor}`}
                aria-hidden="true"
            >
                <span className="text-[120px] sm:text-[180px] font-black uppercase tracking-widest rotate-[-30deg] opacity-100">
                    {isCredit ? "CREDIT" : "DEBIT"}
                </span>
            </div>

            {/* Content (above watermark) */}
            <div className="relative z-10">
                {/* Header */}
                <BillHeader
                    documentNumber={note.narration?.split(" against ")[0] || `Note #${note.id.slice(0, 8)}`}
                    documentLabel={documentLabel}
                    date={formattedDate}
                    status="SETTLED"
                    theme={theme}
                    createdBy={note.createdBy}
                    backPath="/notes"
                    actions={
                        <>
                            <Button
                                variant="bordered"
                                size="sm"
                                startContent={<Printer className="h-3.5 w-3.5" />}
                                onPress={() => window.print()}
                            >
                                Print
                            </Button>
                            <Button
                                variant="bordered"
                                size="sm"
                                startContent={<Download className="h-3.5 w-3.5" />}
                                onPress={() => window.print()}
                            >
                                PDF
                            </Button>
                        </>
                    }
                />

                {/* Contextual fields: Party + Reference Invoice */}
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                    {/* Party Details */}
                    <Card shadow="sm" className={`border-l-4 border-${themeAccent}-500`}>
                        <CardHeader className="px-6 pt-5 pb-0">
                            <h2 className="font-semibold text-sm text-default-500 uppercase tracking-wider">
                                {isCredit ? "Customer" : "Vendor"}
                            </h2>
                        </CardHeader>
                        <CardBody className="p-6 pt-3">
                            <div className="flex items-center gap-3">
                                <div
                                    className={`h-10 w-10 rounded-full bg-${themeAccent}-100 dark:bg-${themeAccent}-900/20 flex items-center justify-center`}
                                >
                                    <span className={`text-lg font-bold text-${themeAccent}-600 dark:text-${themeAccent}-400`}>
                                        {(note.partyName || "?")[0].toUpperCase()}
                                    </span>
                                </div>
                                <div>
                                    <p className="font-semibold text-lg">{note.partyName || "—"}</p>
                                    {partyLine?.partyId && (
                                        <Button
                                            size="sm"
                                            variant="light"
                                            color={isCredit ? "success" : "warning"}
                                            className="mt-1 -ml-2"
                                            onPress={() => router.push(`/parties/${partyLine.partyId}`)}
                                        >
                                            View Party →
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardBody>
                    </Card>

                    {/* Reference Invoice */}
                    <Card shadow="sm" className={`border-l-4 border-${themeAccent}-500`}>
                        <CardHeader className="px-6 pt-5 pb-0">
                            <h2 className="font-semibold text-sm text-default-500 uppercase tracking-wider">
                                Reference Details
                            </h2>
                        </CardHeader>
                        <CardBody className="p-6 pt-3 space-y-3">
                            {note.originalInvoiceNo && (
                                <div>
                                    <p className="text-xs text-default-400">Original Invoice</p>
                                    <p className="font-mono font-semibold text-base">
                                        {note.originalInvoiceNo}
                                    </p>
                                </div>
                            )}
                            {note.reasonForIssuance && (
                                <div>
                                    <p className="text-xs text-default-400">Reason</p>
                                    <Chip
                                        size="sm"
                                        variant="flat"
                                        color={isCredit ? "success" : "warning"}
                                    >
                                        {note.reasonForIssuance}
                                    </Chip>
                                </div>
                            )}
                            {!note.originalInvoiceNo && !note.reasonForIssuance && (
                                <div>
                                    <p className="text-xs text-default-400">Narration</p>
                                    <p className="text-sm text-default-600">{note.narration}</p>
                                </div>
                            )}
                        </CardBody>
                    </Card>
                </div>

                {/* Journal Lines (as line items) */}
                <BillLineItems
                    items={lineItems}
                    mode="journal"
                    themeColor={theme}
                />

                {/* Summary */}
                <div className="grid lg:grid-cols-2 gap-6 mb-6">
                    {/* Balance effect explanation */}
                    <Card shadow="sm">
                        <CardBody className="p-6">
                            <h3 className="font-semibold text-sm mb-3 text-default-600">
                                Balance Effect
                            </h3>
                            <div className={`rounded-xl p-4 bg-${themeAccent}-50 dark:bg-${themeAccent}-950/20 border border-${themeAccent}-200 dark:border-${themeAccent}-800`}>
                                <div className="flex items-center gap-3">
                                    <ThemeIcon className={`h-5 w-5 text-${themeAccent}-600 dark:text-${themeAccent}-400`} />
                                    <div>
                                        <p className={`font-semibold text-${themeAccent}-700 dark:text-${themeAccent}-300`}>
                                            {isCredit
                                                ? "Balance reduced by"
                                                : "Balance increased by"}{" "}
                                            {formatCurrency(note.grandTotal)}
                                        </p>
                                        <p className="text-xs text-default-500 mt-1">
                                            {isCredit
                                                ? "This credit note reduces the customer's outstanding balance."
                                                : "This debit note increases the vendor's outstanding balance."}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardBody>
                    </Card>

                    {/* Financial summary */}
                    <BillSummary
                        subtotal={subtotal}
                        taxSlabs={taxSlabs.length > 0 ? taxSlabs : undefined}
                        taxAmount={totalTax}
                        grandTotal={note.grandTotal}
                        theme={theme}
                        showAmountInWords
                        amountStyle={isCredit ? "credit" : "debit"}
                    />
                </div>

                {/* Footer */}
                <BillFooter showActions={false} />
            </div>

            {/* ── Print-Only Professional Layout ──────────────── */}
            <div
                className="hidden print:block p-0 text-black"
                style={{ fontSize: "11pt", lineHeight: "1.5" }}
            >
                {/* Title band */}
                <div style={{ borderBottom: "3px solid #000", paddingBottom: "16px", marginBottom: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                            <div
                                style={{
                                    fontSize: "14pt",
                                    fontWeight: 800,
                                    border: `2px solid ${isCredit ? "#059669" : "#d97706"}`,
                                    color: isCredit ? "#059669" : "#d97706",
                                    padding: "4px 16px",
                                    display: "inline-block",
                                    marginBottom: "8px",
                                    letterSpacing: "2px",
                                }}
                            >
                                {isCredit ? "CREDIT MEMO" : "DEBIT MEMO"}
                            </div>
                        </div>
                        <div style={{ textAlign: "right", fontSize: "9pt", lineHeight: "1.8" }}>
                            <div>
                                <strong>Date:</strong>{" "}
                                {new Date(note.entryDate).toLocaleDateString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                })}
                            </div>
                            {note.originalInvoiceNo && (
                                <div>
                                    <strong>Ref Invoice:</strong>{" "}
                                    <span style={{ fontFamily: "monospace" }}>
                                        {note.originalInvoiceNo}
                                    </span>
                                </div>
                            )}
                            {note.reasonForIssuance && (
                                <div>
                                    <strong>Reason:</strong> {note.reasonForIssuance}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Party details */}
                <div style={{ border: "1px solid #ccc", padding: "12px", borderRadius: "4px", marginBottom: "16px", fontSize: "9pt" }}>
                    <div style={{ fontSize: "8pt", fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: "6px" }}>
                        {isCredit ? "Customer" : "Vendor"}
                    </div>
                    <div style={{ fontSize: "12pt", fontWeight: 700 }}>
                        {note.partyName || "—"}
                    </div>
                </div>

                {/* Journal entries table */}
                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "16px", fontSize: "9pt" }}>
                    <thead>
                        <tr style={{ backgroundColor: "#f5f5f5" }}>
                            <th style={{ border: "1px solid #999", padding: "8px 6px", textAlign: "center", fontWeight: 700, width: "36px" }}>#</th>
                            <th style={{ border: "1px solid #999", padding: "8px 6px", fontWeight: 700, textAlign: "left" }}>Account</th>
                            <th style={{ border: "1px solid #999", padding: "8px 6px", fontWeight: 700, textAlign: "right" }}>Debit (₹)</th>
                            <th style={{ border: "1px solid #999", padding: "8px 6px", fontWeight: 700, textAlign: "right" }}>Credit (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {note.lines.map((line, i) => (
                            <tr key={line.id}>
                                <td style={{ border: "1px solid #ccc", padding: "7px 6px", textAlign: "center", color: "#666" }}>{i + 1}</td>
                                <td style={{ border: "1px solid #ccc", padding: "7px 6px" }}>
                                    {ACCOUNT_LABELS[line.accountCode] || line.accountCode}
                                    {line.partyName && (
                                        <span style={{ color: "#888", marginLeft: "8px", fontSize: "8pt" }}>
                                            ({line.partyName})
                                        </span>
                                    )}
                                </td>
                                <td style={{ border: "1px solid #ccc", padding: "7px 6px", textAlign: "right", fontFamily: "monospace" }}>
                                    {line.debit > 0 ? formatCurrency(line.debit) : "—"}
                                </td>
                                <td style={{ border: "1px solid #ccc", padding: "7px 6px", textAlign: "right", fontFamily: "monospace" }}>
                                    {line.credit > 0 ? formatCurrency(line.credit) : "—"}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Totals */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                    <div style={{ fontSize: "8pt" }}>
                        <div style={{ marginTop: "16px", borderTop: "1px solid #ddd", paddingTop: "8px" }}>
                            <div style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#888", marginBottom: "4px", fontSize: "7pt" }}>
                                Amount in Words
                            </div>
                            <div style={{ fontWeight: 600, fontStyle: "italic", fontSize: "9pt" }}>
                                {numberToIndianWords(note.grandTotal)}
                            </div>
                        </div>
                    </div>
                    <div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
                            <tbody>
                                <tr>
                                    <td style={{ padding: "6px 8px", borderBottom: "1px solid #eee" }}>Subtotal</td>
                                    <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "monospace", borderBottom: "1px solid #eee" }}>
                                        {formatCurrency(subtotal)}
                                    </td>
                                </tr>
                                {taxSlabs.map((slab, i) => (
                                    <tr key={i}>
                                        <td style={{ padding: "6px 8px", borderBottom: "1px solid #eee", color: "#444" }}>
                                            {slab.label}
                                        </td>
                                        <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "monospace", borderBottom: "1px solid #eee" }}>
                                            {formatCurrency(slab.amount)}
                                        </td>
                                    </tr>
                                ))}
                                <tr style={{ fontWeight: 800 }}>
                                    <td style={{ padding: "10px 8px", borderTop: `2px solid ${isCredit ? "#059669" : "#d97706"}`, fontSize: "12pt" }}>
                                        Grand Total
                                    </td>
                                    <td
                                        style={{
                                            padding: "10px 8px",
                                            textAlign: "right",
                                            fontFamily: "monospace",
                                            borderTop: `2px solid ${isCredit ? "#059669" : "#d97706"}`,
                                            fontSize: "12pt",
                                            color: isCredit ? "#059669" : "#d97706",
                                        }}
                                    >
                                        {isCredit
                                            ? `(${formatCurrency(note.grandTotal)})`
                                            : `+${formatCurrency(note.grandTotal)}`}
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Signatory */}
                        <div style={{ marginTop: "40px", textAlign: "right", paddingRight: "8px" }}>
                            <div style={{ borderBottom: "1px solid #999", width: "180px", marginLeft: "auto", marginBottom: "6px", height: "40px" }} />
                            <div style={{ fontSize: "8pt", fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "1px" }}>
                                Authorized Signatory
                            </div>
                        </div>
                    </div>
                </div>

                {/* Print footer */}
                <div
                    style={{
                        marginTop: "32px",
                        borderTop: "1px solid #ccc",
                        paddingTop: "8px",
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "7pt",
                        color: "#aaa",
                    }}
                >
                    <div>Generated by HisaabKitaab • This is a computer-generated document</div>
                    <div>Page 1 of 1</div>
                </div>
            </div>
        </div>
    );
}
