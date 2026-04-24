"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardBody, Chip, Button, useDisclosure, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/react";

const TrashIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
);

function formatCurrency(n: number): string {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(n);
}

function formatSignedCurrency(value: number) {
    if (value === 0) return "INR 0.00";
    return `${value > 0 ? "+" : "-"}${formatCurrency(Math.abs(value))}`;
}

type BankAccountProps = {
    name: string;
    type: "BANK" | "CASH";
    accountNumber: string | null;
    openingBalance: number;
    currentBalance: number;
};

type LedgerEntry = {
    id: string;
    date: Date;
    direction: "INCOMING" | "OUTGOING";
    mode: string;
    amount: number;
    partyName: string;
    increase: number;
    decrease: number;
    runningBalance: number;
};

export default function BankLedgerClient({
    accountId,
    account,
    ledger,
    role,
}: {
    accountId: string;
    account: BankAccountProps;
    ledger: LedgerEntry[];
    role: string | null;
}) {
    const router = useRouter();
    const [paymentToDelete, setPaymentToDelete] = useState<LedgerEntry | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const { isOpen, onOpen, onClose, onOpenChange } = useDisclosure();

    const handleDeletePayment = async () => {
        if (!paymentToDelete) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/payments/${paymentToDelete.id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                router.refresh();
                onClose();
                setPaymentToDelete(null);
            } else {
                const data = await res.json();
                alert(data.error || "Failed to delete payment");
            }
        } catch (e: any) {
            console.error(e);
            alert("Error deleting payment");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link
                        href="/banking"
                        className="rounded-xl p-2 transition hover:bg-default-100"
                    >
                        <svg
                            className="h-5 w-5 text-default-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                d="M10 19l-7-7m0 0l7-7m-7 7h18"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                            />
                        </svg>
                    </Link>
                    <div>
                        <h1 className="flex items-center gap-3 text-2xl font-bold">
                            {account.name}
                            <Chip
                                size="sm"
                                color={account.type === "BANK" ? "primary" : "secondary"}
                                variant="flat"
                            >
                                {account.type}
                            </Chip>
                        </h1>
                        {account.accountNumber && (
                            <p className="text-sm font-mono text-default-500">
                                A/c: {account.accountNumber}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Passbook / Ledger Column */}
                <div className="space-y-6 lg:col-span-2">
                    <Card shadow="sm">
                        <CardBody className="p-0">
                            <div className="border-b border-default-200 bg-default-50 px-5 py-4">
                                <h2 className="text-lg font-semibold flex flex-row items-center gap-2">
                                    <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Transactions
                                </h2>
                            </div>
                            <div className="divide-y divide-default-100 overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-default-50/50 text-default-500">
                                        <tr>
                                            <th className="px-5 py-3 font-medium">Date</th>
                                            <th className="px-5 py-3 font-medium">Particulars</th>
                                            <th className="px-5 py-3 font-medium text-right">In (+)</th>
                                            <th className="px-5 py-3 font-medium text-right">Out (-)</th>
                                            <th className="px-5 py-3 font-medium text-right">Balance</th>
                                            <th className="px-5 py-3 font-medium text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td className="px-5 py-4 text-default-500">-</td>
                                            <td className="px-5 py-4 font-medium italic text-default-500">Opening Balance</td>
                                            <td className="px-5 py-4 text-right">
                                                {account.openingBalance > 0 ? formatCurrency(account.openingBalance) : "-"}
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                {account.openingBalance < 0 ? formatCurrency(Math.abs(account.openingBalance)) : "-"}
                                            </td>
                                            <td className="px-5 py-4 text-right font-medium text-default-900">
                                                {formatCurrency(account.openingBalance)}
                                            </td>
                                            <td className="px-5 py-4 text-right"></td>
                                        </tr>
                                        {ledger.map((entry) => (
                                            <tr key={entry.id} className="transition hover:bg-default-50">
                                                <td className="px-5 py-4 whitespace-nowrap text-default-500">
                                                    {new Date(entry.date).toLocaleDateString("en-IN", {
                                                        day: "2-digit",
                                                        month: "short",
                                                        year: "numeric",
                                                    })}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <p className="font-medium text-default-900">{entry.partyName}</p>
                                                    <p className="text-xs text-default-400 capitalize flex items-center gap-1 mt-0.5">
                                                        {entry.mode.toLowerCase().replace("_", " ")}
                                                    </p>
                                                </td>
                                                <td className="px-5 py-4 text-right font-medium text-success">
                                                    {entry.increase > 0 ? formatCurrency(entry.increase) : "-"}
                                                </td>
                                                <td className="px-5 py-4 text-right font-medium text-danger">
                                                    {entry.decrease > 0 ? formatCurrency(entry.decrease) : "-"}
                                                </td>
                                                <td className="px-5 py-4 text-right font-bold text-default-900">
                                                    {formatCurrency(entry.runningBalance)}
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <Button
                                                        isIconOnly
                                                        size="sm"
                                                        color="danger"
                                                        variant="light"
                                                        onPress={() => {
                                                            setPaymentToDelete(entry);
                                                            onOpen();
                                                        }}
                                                    >
                                                        <TrashIcon className="h-4 w-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                        {ledger.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="py-8 text-center text-default-500">
                                                    No transactions found for this account.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardBody>
                    </Card>
                </div>

                {/* Account Details Box */}
                <div className="space-y-6">
                    <Card shadow="sm">
                        <CardBody className="p-5">
                            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                                <svg
                                    className="h-5 w-5 text-secondary"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={1.5}
                                    />
                                </svg>
                                Account Details
                            </h2>
                            <div className="space-y-3 text-sm">
                                <div>
                                    <p className="text-xs text-default-400">Account Type</p>
                                    <p className="font-medium">{account.type === "BANK" ? "Bank Account" : "Cash Register"}</p>
                                </div>
                                {account.accountNumber && (
                                    <div>
                                        <p className="text-xs text-default-400">Account Number</p>
                                        <p className="font-medium font-mono">{account.accountNumber}</p>
                                    </div>
                                )}
                                <div>
                                    <p className="text-xs text-default-400">Opening Balance</p>
                                    <p className="font-medium">
                                        {formatSignedCurrency(account.openingBalance)}
                                    </p>
                                </div>
                                <div className="mt-4 pt-4 border-t border-default-100">
                                    <p className="text-xs text-default-400">Current Balance</p>
                                    <p className={`text-xl font-bold ${account.currentBalance >= 0 ? "text-success" : "text-danger"}`}>
                                        {formatSignedCurrency(account.currentBalance)}
                                    </p>
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={isOpen}
                onOpenChange={onOpenChange}
                backdrop="blur"
                placement="center"
                classNames={{
                    backdrop: "bg-black/60",
                }}
            >
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 rounded-full bg-danger/10">
                                        <TrashIcon className="w-5 h-5 text-danger" />
                                    </div>
                                    <span className="text-xl font-bold">Delete Transaction</span>
                                </div>
                            </ModalHeader>
                            <ModalBody>
                                <p className="text-default-500">
                                    Are you sure you want to delete this {paymentToDelete?.mode.toLowerCase().replace("_", " ")} transaction for <span className="font-semibold text-foreground">{formatCurrency(paymentToDelete?.amount || 0)}</span>?
                                    This will reverse the balances and this action cannot be undone.
                                </p>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="flat" onPress={onClose} disabled={isDeleting}>
                                    Cancel
                                </Button>
                                <Button
                                    color="danger"
                                    onPress={handleDeletePayment}
                                    isLoading={isDeleting}
                                    className="font-semibold shadow-lg shadow-danger/20"
                                >
                                    Delete Transaction
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
}
