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

    // Fetch all payments mapped to this bank account (source or destination)
    const payments = await prisma.payment.findMany({
        where: {
            tenantId,
            OR: [
                { accountId: id },
                { destinationAccountId: id }
            ],
            isDeleted: false,
            status: "COMPLETED",
        },
        include: {
            party: { select: { name: true, type: true } },
            account: { select: { name: true } },
            destinationAccount: { select: { name: true } },
        },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });

    // Calculate generic ledger running balances
    const initialBalance = account.openingBalance.toNumber();
    let currentRunning = initialBalance;

    const ledger = payments.map(p => {
        const amt = p.amount.toNumber();
        let increase = 0;
        let decrease = 0;

        // If this account is the destination account for a Contra transfer, it received money.
        // If this account is the source account, it follows the native p.direction (which is OUTGOING for Contras).
        // Wait, standard payments have direction OUTGOING (money paid) or INCOMING (money received) at the source account.
        const isDestination = p.destinationAccountId === id;
        const actualDirection = isDestination ? "INCOMING" : p.direction;

        if (actualDirection === "INCOMING") {
            increase = amt;
            currentRunning += amt;
        } else {
            decrease = amt;
            currentRunning -= amt;
        }

        // Determine who the counterparty is
        let displayPartyName = p.party?.name || "Party";
        if (!p.party) {
            // It's a Contra Entry
            if (isDestination) {
                displayPartyName = `Transfer from ${p.account?.name || "Bank/Cash"}`;
            } else {
                displayPartyName = `Transfer to ${p.destinationAccount?.name || "Bank/Cash"}`;
            }
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
            partyId: p.partyId,
            paymentAccountId: p.accountId,
            destinationAccountId: p.destinationAccountId,
            partyType: p.party?.type ?? null,
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
