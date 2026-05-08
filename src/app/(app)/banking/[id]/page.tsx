import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { resolveServerSession } from "@/lib/session-server";
import BankLedgerClient from "./BankLedgerClient";

export const dynamic = "force-dynamic";

export default async function BankLedgerPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const session = await resolveServerSession();

    if (!session) {
        return notFound();
    }

    const { tenantId, role } = session;

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

    const payments = await prisma.payment.findMany({
        where: {
            tenantId,
            OR: [
                { accountId: id },
                { destinationAccountId: id },
            ],
            isDeleted: false,
            status: "COMPLETED",
        },
        include: {
            party: { select: { name: true, type: true } },
            BankAccount_Payment_accountIdToBankAccount: { select: { name: true } },
            BankAccount_Payment_destinationAccountIdToBankAccount: { select: { name: true } },
        },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });

    const initialBalance = account.openingBalance.toNumber();
    let currentRunning = initialBalance;

    const ledger = payments.map((p) => {
        const amt = p.amount.toNumber();
        let increase = 0;
        let decrease = 0;

        const isDestination = p.destinationAccountId === id;
        const actualDirection = isDestination ? "INCOMING" : p.direction;

        if (actualDirection === "INCOMING") {
            increase = amt;
            currentRunning += amt;
        } else {
            decrease = amt;
            currentRunning -= amt;
        }

        let displayPartyName = p.party?.name || "Party";
        if (!p.party) {
            const srcName = p.BankAccount_Payment_accountIdToBankAccount?.name;
            const dstName = p.BankAccount_Payment_destinationAccountIdToBankAccount?.name;
            displayPartyName = isDestination
                ? `Transfer from ${srcName || "Bank/Cash"}`
                : `Transfer to ${dstName || "Bank/Cash"}`;
        }

        return {
            id: p.id,
            date: p.date,
            direction: actualDirection as "INCOMING" | "OUTGOING",
            mode: p.mode,
            amount: amt,
            partyName: displayPartyName,
            notes: p.notes,
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
