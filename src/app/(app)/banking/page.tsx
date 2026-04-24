"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { Button, Card, CardBody, useDisclosure } from "@heroui/react";
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

export default function BankingDashboard() {
    const [accounts, setAccounts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);
    const { isOpen: isAddAccountOpen, onOpen: onAddAccountOpen, onOpenChange: onAddAccountChange } = useDisclosure();

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
                                        <div className="flex items-center gap-x-6">
                                            <div className="hidden sm:flex sm:flex-col sm:items-end">
                                                <p className="text-sm leading-6 text-default-900 font-medium">
                                                    {formatCurrency(Number(account.currentBalance))}
                                                </p>
                                                <p className="mt-1 text-xs leading-5 text-default-500">Current Balance</p>
                                            </div>
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
        </div>
    );
}
