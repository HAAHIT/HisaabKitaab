"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { Button, Card, CardBody, useDisclosure, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/react";
import { AddBankAccountModal } from "@/components/banking/AddBankAccountModal";

const BuildingLibraryIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
    </svg>
);

const BanknotesIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 011.694-1.122M2.25 18l5.228-5.23m-5.23 5.23h19.5M16.5 13.5l3.75-3.75M16.5 13.5v-3.75m0 3.75h-3.75M10.125 19.5h3.75m-3.75 0V15.75M10.125 19.5a1.5 1.5 0 01-1.5-1.5" />
    </svg>
);

const PlusIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
);

const ArrowsRightLeftIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
);

const ChevronRightIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
);

const TrashIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
);

export default function BankingDashboard() {
    const [accounts, setAccounts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);
    const [accountToDelete, setAccountToDelete] = useState<any | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { isOpen: isAddAccountOpen, onOpen: onAddAccountOpen, onOpenChange: onAddAccountChange } = useDisclosure();
    const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onOpenChange: onDeleteChange, onClose: onDeleteClose } = useDisclosure();

    const fetchAccounts = useCallback(async () => {
        setIsLoading(true);
        setError(false);
        try {
            const res = await fetch("/api/bank-accounts");
            if (!res.ok) throw new Error("Failed to fetch bank accounts");
            const data = await res.json();
            setAccounts(data.accounts || []);
        } catch (err) {
            console.error(err);
            setError(true);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAccounts();
    }, [fetchAccounts]);
    const bankAccounts = accounts.filter((a: any) => a.type === "BANK");
    const cashAccounts = accounts.filter((a: any) => a.type === "CASH");

    const totalBankBalance = bankAccounts.reduce((acc: number, val: any) => acc + Number(val.currentBalance), 0);
    const totalCashBalance = cashAccounts.reduce((acc: number, val: any) => acc + Number(val.currentBalance), 0);

    const handleDeleteAccount = async () => {
        if (!accountToDelete) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/bank-accounts/${accountToDelete.id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                await fetchAccounts();
                onDeleteClose();
                setAccountToDelete(null);
            } else {
                const data = await res.json();
                alert(data.error || "Failed to delete account");
            }
        } catch (e: any) {
            console.error(e);
            alert("Error deleting account");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="mx-auto max-w-[1200px] animate-fade-in p-4 lg:p-8">
            <div className="mb-6 space-y-8">
                {/* Header section */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight text-default-900">
                            Banking
                        </h1>
                        <p className="text-sm text-default-500">
                            Manage your bank accounts, cash registers, and view balances
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <Button
                            variant="bordered"
                            startContent={<ArrowsRightLeftIcon className="h-4 w-4" />}
                            as={Link}
                            href="/payments/new"
                        >
                            Contra Entry
                        </Button>
                        <Button
                            color="primary"
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold shadow-lg shadow-blue-500/25"
                            startContent={<PlusIcon className="h-5 w-5" />}
                            onPress={onAddAccountOpen}
                        >
                            Add Account
                        </Button>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    {/* Bank Balance Card */}
                    <Card shadow="sm" className="bg-content1">
                        <CardBody className="p-6">
                            <div className="flex items-center gap-3 text-default-500">
                                <BuildingLibraryIcon className="h-6 w-6 text-primary" />
                                <h3 className="text-sm font-medium">Total Bank Balance</h3>
                            </div>
                            <div className="mt-4 flex items-baseline gap-2">
                                <span className="text-3xl font-bold tracking-tight text-default-900">
                                    {isLoading ? "..." : formatCurrency(totalBankBalance)}
                                </span>
                            </div>
                        </CardBody>
                    </Card>

                    {/* Cash Balance Card */}
                    <Card shadow="sm" className="bg-content1">
                        <CardBody className="p-6">
                            <div className="flex items-center gap-3 text-default-500">
                                <BanknotesIcon className="h-6 w-6 text-success" />
                                <h3 className="text-sm font-medium">Total Cash in Hand</h3>
                            </div>
                            <div className="mt-4 flex items-baseline gap-2">
                                <span className="text-3xl font-bold tracking-tight text-default-900">
                                    {isLoading ? "..." : formatCurrency(totalCashBalance)}
                                </span>
                            </div>
                        </CardBody>
                    </Card>
                </div>

                {isLoading && (
                    <div className="animate-pulse space-y-4 pt-4">
                        <div className="h-10 w-full rounded bg-gray-200" />
                        <div className="h-10 w-full rounded bg-gray-200" />
                    </div>
                )}

                {error && (
                    <div className="rounded-md bg-red-50 p-4 border border-red-200">
                        <div className="text-sm text-red-800">
                            Failed to load bank accounts.
                        </div>
                    </div>
                )}

                {!isLoading && !error && accounts.length === 0 && (
                    <Card shadow="sm" className="mt-8 border border-default-200 bg-content1">
                        <CardBody className="flex flex-col items-center justify-center py-16">
                            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                                <BuildingLibraryIcon className="h-10 w-10 text-primary" />
                            </div>
                            <h3 className="text-lg font-medium text-default-900">No bank accounts</h3>
                            <p className="mt-1 text-sm text-default-500">
                                Get started by creating a new bank or cash account.
                            </p>
                            <Button
                                color="primary"
                                variant="flat"
                                size="sm"
                                className="mt-4"
                                startContent={<PlusIcon className="h-4 w-4" />}
                            >
                                Add Account
                            </Button>
                        </CardBody>
                    </Card>
                )}

                {!isLoading && accounts.length > 0 && (
                    <Card shadow="sm" className="mt-8 border border-default-200 bg-content1">
                        <CardBody className="p-0">
                            <ul role="list" className="divide-y divide-default-200">
                                {accounts.map((account: any) => (
                                    <li
                                        key={account.id}
                                        className="relative flex items-center justify-between px-6 py-5 transition hover:bg-content2"
                                    >
                                        <div className="flex items-center gap-x-4">
                                            <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-default-50 border border-default-200">
                                                {account.type === "CASH" ? (
                                                    <BanknotesIcon className="h-5 w-5 text-success" />
                                                ) : (
                                                    <BuildingLibraryIcon className="h-5 w-5 text-primary" />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-start gap-x-3">
                                                    <p className="text-sm font-semibold leading-6 text-default-900">
                                                        <Link href={`/banking/${account.id}`}>
                                                            <span className="absolute inset-x-0 -top-px bottom-0" />
                                                            {account.name}
                                                        </Link>
                                                    </p>
                                                    <p
                                                        className={`mt-0.5 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${account.type === "BANK"
                                                            ? "bg-primary/10 text-primary ring-primary/20"
                                                            : "bg-success/10 text-success ring-success/20"
                                                            }`}
                                                    >
                                                        {account.type}
                                                    </p>
                                                </div>
                                                {account.accountNumber && (
                                                    <div className="mt-1 flex items-center gap-x-2 text-xs leading-5 text-default-500">
                                                        <p className="truncate">A/c: {account.accountNumber}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-x-6 relative z-10">
                                            <div className="hidden sm:flex sm:flex-col sm:items-end mr-4">
                                                <p className="text-sm leading-6 text-default-900 font-medium">
                                                    {formatCurrency(Number(account.currentBalance))}
                                                </p>
                                                <p className="mt-1 text-xs leading-5 text-default-500">Current Balance</p>
                                            </div>
                                            <Button
                                                isIconOnly
                                                variant="light"
                                                color="danger"
                                                size="sm"
                                                onPress={() => {
                                                    setAccountToDelete(account);
                                                    onDeleteOpen();
                                                }}
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </Button>
                                            <ChevronRightIcon className="h-5 w-5 flex-none text-default-400" aria-hidden="true" />
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </CardBody>
                    </Card>
                )}
            </div>
            <AddBankAccountModal
                isOpen={isAddAccountOpen}
                onOpenChange={onAddAccountChange}
                onSuccess={() => fetchAccounts()}
            />

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={isDeleteOpen}
                onOpenChange={onDeleteChange}
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
                                    <span className="text-xl font-bold">Delete Account</span>
                                </div>
                            </ModalHeader>
                            <ModalBody>
                                <p className="text-default-500">
                                    Are you sure you want to delete <span className="font-semibold text-foreground">{accountToDelete?.name}</span>?
                                    This will hide the account from being used in future payments. Existing history will remain intact.
                                </p>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="flat" onPress={onDeleteClose} disabled={isDeleting}>
                                    Cancel
                                </Button>
                                <Button
                                    color="danger"
                                    onPress={handleDeleteAccount}
                                    isLoading={isDeleting}
                                    className="font-semibold shadow-lg shadow-danger/20"
                                >
                                    Delete Account
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
}
