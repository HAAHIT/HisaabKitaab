import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { resolveTenantIdFromRequest } from "@/lib/tenant";
import BankLedgerClient from "./BankLedgerClient";

export const dynamic = "force-dynamic";

export default async function BankLedgerPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const headerStore = await headers();
    const tenantId = resolveTenantIdFromRequest({ headers: headerStore });
    const role = headerStore.get("x-user-role");

    if (!tenantId) {
        return notFound();
    }

    const account = await prisma.bankAccount.findFirst({
        where: {
            id,
            tenantId,
            isDeleted: false,
        },
    });

    if (!account) {
        return notFound();
    }

    // Fetch all payments mapped to this bank account
    const payments = await prisma.payment.findMany({
        where: {
            tenantId,
            accountId: id,
            isDeleted: false,
            status: "COMPLETED",
        },
        include: {
            party: {
                select: {
                    name: true,
                },
            },
        },
        orderBy: { date: "asc" },
    });

    // Calculate generic ledger running balances
    const initialBalance = account.openingBalance.toNumber();
    let currentRunning = initialBalance;

    const ledger = payments.map(p => {
        const amt = p.amount.toNumber();
        let increase = 0;
        let decrease = 0;

        // INCOMING means we received money into this account -> increase
        // OUTGOING means we paid money out of this account -> decrease
        if (p.direction === "INCOMING") {
            increase = amt;
            currentRunning += amt;
        } else {
            decrease = amt;
            currentRunning -= amt;
        }

        return {
            id: p.id,
            date: p.date,
            direction: p.direction as "INCOMING" | "OUTGOING",
            mode: p.mode,
            amount: amt,
            partyName: p.party?.name || "Contra/Transfer", // If no party, it's considered contra/transfer
            increase,
            decrease,
            runningBalance: currentRunning,
        };
    });

    return (
        <BankLedgerClient
            accountId={account.id}
            account={{
                name: account.name,
                type: account.type as "BANK" | "CASH",
                accountNumber: account.accountNumber,
                openingBalance: initialBalance,
                currentBalance: currentRunning,
            }}
            ledger={ledger}
            role={role}
        />
    );
}
