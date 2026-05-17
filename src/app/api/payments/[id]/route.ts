import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSession } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";
import { getPaymentBalanceDelta, asSupportedPartyType } from "@/lib/accounting";
import { generateLockKey } from "@/lib/locks";
import {
    journalForPaymentReceived,
    journalForPaymentMade,
    journalForContraEntry,
    journalForLedgerPayment,
} from "@/lib/journal";

const LEDGER_PARTY_TYPES = new Set(["EXPENSE", "INCOME", "ASSET", "LIABILITY", "EQUITY"]);

const VALID_MODES = new Set(["CASH", "UPI", "BANK_TRANSFER", "CHEQUE"]);
type SupportedPaymentMode = "CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE";

function normalizeMode(value: unknown): SupportedPaymentMode | null {
    if (typeof value !== "string") return null;
    return VALID_MODES.has(value) ? (value as SupportedPaymentMode) : null;
}

function parseAmount(value: unknown): number | null {
    const n = typeof value === "number" ? value : typeof value === "string" ? parseFloat(value) : NaN;
    if (!isFinite(n) || n <= 0) return null;
    return Math.round(n * 100) / 100;
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const reqId = getRequestId(request);
    const { id } = await params;

    const sessionResolution = await resolveSession(request);
    if (!sessionResolution.ok) {
        return sessionResolution.response;
    }
    const { tenantId, userId, role } = sessionResolution.session;

    if (role === "CUSTOMER") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { date, notes, amount, direction, mode, accountId, partyId, destinationAccountId } = body;

        const parsedAmount = amount !== undefined ? parseAmount(amount) : undefined;
        if (amount !== undefined && !parsedAmount) {
            return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
        }
        const normalizedMode = mode !== undefined ? normalizeMode(mode) : undefined;
        if (mode !== undefined && !normalizedMode) {
            return NextResponse.json({ error: "Invalid payment mode" }, { status: 400 });
        }
        if (direction !== undefined && !["INCOMING", "OUTGOING"].includes(direction)) {
            return NextResponse.json({ error: "Invalid direction" }, { status: 400 });
        }
        let parsedDate: Date | undefined;
        if (date !== undefined) {
            parsedDate = new Date(date);
            if (isNaN(parsedDate.getTime())) {
                return NextResponse.json({ error: "Invalid date" }, { status: 400 });
            }
        }

        const result = await prisma.$transaction(async (tx) => {
            const lockKey = generateLockKey(tenantId);
            await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

            const payment = await tx.payment.findFirst({
                where: { id, tenantId, isDeleted: false },
                include: { party: true },
            });
            if (!payment) throw new Error("Payment not found");

            // Step 1: Reverse old effects if COMPLETED
            if (payment.status === "COMPLETED") {
                const oldIsContra = !payment.partyId && !!payment.destinationAccountId;
                if (payment.party && payment.partyId && !LEDGER_PARTY_TYPES.has(payment.party.type)) {
                    const oldDelta = getPaymentBalanceDelta(
                        asSupportedPartyType(payment.party.type), payment.direction, payment.amount.toNumber()
                    );
                    await tx.party.update({
                        where: { id: payment.partyId },
                        data: { currentBalance: { decrement: oldDelta } },
                    });
                }
                if (payment.accountId) {
                    const oldBankDelta = oldIsContra
                        ? -payment.amount.toNumber()
                        : (payment.direction === "INCOMING" ? payment.amount.toNumber() : -payment.amount.toNumber());
                    await tx.bankAccount.update({
                        where: { id: payment.accountId },
                        data: { currentBalance: { decrement: oldBankDelta } },
                    });
                }
                if (payment.destinationAccountId) {
                    await tx.bankAccount.update({
                        where: { id: payment.destinationAccountId },
                        data: { currentBalance: { decrement: payment.amount.toNumber() } },
                    });
                }
                await tx.journalEntry.updateMany({
                    where: { paymentId: id, tenantId },
                    data: { isBalanced: false, syncState: "MODIFIED" },
                });
            }

            // Step 2: Resolve new values
            const newAmount = parsedAmount ?? payment.amount.toNumber();
            const newDirection = (direction as "INCOMING" | "OUTGOING") ?? payment.direction;
            const newMode = normalizedMode ?? payment.mode;
            const newAccountId = accountId !== undefined ? accountId : payment.accountId;
            const newPartyId = partyId !== undefined ? (partyId || null) : payment.partyId;
            const newDestId = destinationAccountId !== undefined
                ? (destinationAccountId || null) : payment.destinationAccountId;
            const newDate = parsedDate ?? payment.date;
            const newNotes = notes !== undefined ? (notes || null) : payment.notes;
            const isContra = !newPartyId && !!newDestId;

            const newParty = newPartyId ? await tx.party.findFirst({
                where: { id: newPartyId, tenantId, isDeleted: false },
                select: { id: true, name: true, type: true },
            }) : null;
            if (newPartyId && !newParty) throw new Error("Party not found");

            // Step 3: Update payment record
            const updated = await tx.payment.update({
                where: { id },
                data: {
                    amount: newAmount,
                    direction: newDirection,
                    mode: newMode,
                    accountId: newAccountId,
                    partyId: newPartyId,
                    destinationAccountId: newDestId,
                    date: newDate,
                    notes: newNotes,
                },
            });

            // Step 4: Reapply effects if COMPLETED
            if (payment.status === "COMPLETED") {
                const isLedgerParty = newParty ? LEDGER_PARTY_TYPES.has(newParty.type) : false;

                if (!isContra && newParty && !isLedgerParty) {
                    const newDelta = getPaymentBalanceDelta(asSupportedPartyType(newParty.type), newDirection, newAmount);
                    await tx.party.update({
                        where: { id: newParty.id },
                        data: { currentBalance: { increment: newDelta } },
                    });
                }
                if (newAccountId) {
                    const newBankDelta = isContra ? -newAmount : (newDirection === "INCOMING" ? newAmount : -newAmount);
                    await tx.bankAccount.update({
                        where: { id: newAccountId },
                        data: { currentBalance: { increment: newBankDelta } },
                    });
                }
                if (isContra && newDestId) {
                    await tx.bankAccount.update({
                        where: { id: newDestId },
                        data: { currentBalance: { increment: newAmount } },
                    });
                }

                if (isContra && newAccountId && newDestId) {
                    const srcAcc = await tx.bankAccount.findUnique({ where: { id: newAccountId }, select: { type: true } });
                    const dstAcc = await tx.bankAccount.findUnique({ where: { id: newDestId }, select: { type: true } });
                    await journalForContraEntry(tx, tenantId, {
                        id: updated.id, partyId: null, partyName: null,
                        amount: newAmount, mode: newMode, date: newDate, createdBy: payment.createdBy,
                        sourceAccountType: srcAcc?.type, destAccountType: dstAcc?.type,
                    });
                } else if (!isContra && newParty) {
                    const journalArgs = {
                        id: updated.id, partyId: newParty.id, partyName: newParty.name,
                        amount: newAmount, mode: newMode, date: newDate, createdBy: payment.createdBy,
                    };
                    if (isLedgerParty) {
                        await journalForLedgerPayment(tx, tenantId, { ...journalArgs, partyType: newParty.type });
                    } else if (newDirection === "INCOMING") {
                        await journalForPaymentReceived(tx, tenantId, journalArgs);
                    } else {
                        await journalForPaymentMade(tx, tenantId, journalArgs);
                    }
                }
            }

            await tx.auditLog.create({
                data: {
                    tenantId, entityType: "Payment", entityId: id,
                    userId: userId || payment.createdBy, action: "UPDATE",
                },
            });

            return updated;
        }, { isolationLevel: "RepeatableRead" });

        return NextResponse.json({ payment: result });
    } catch (error) {
        logError("payments.edit.error", { requestId: reqId, error });
        const msg = error instanceof Error ? error.message : "Failed to update payment";
        return NextResponse.json({ error: msg }, { status: 400 });
    }
}

export const runtime = "nodejs";

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const reqId = getRequestId(request);
    const { id } = await params;

    const sessionResolution = await resolveSession(request);
    if (!sessionResolution.ok) {
        return sessionResolution.response;
    }
    const { tenantId, userId, role } = sessionResolution.session;

    if (role === "CUSTOMER") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            const lockKey = generateLockKey(tenantId);
            await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

            const payment = await tx.payment.findFirst({
                where: { id, tenantId, isDeleted: false },
                include: { party: true },
            });

            if (!payment) throw new Error("Payment not found");

            if (payment.status === "COMPLETED") {
                const isContra = !payment.partyId && !!payment.destinationAccountId;
                if (payment.party && payment.partyId && !LEDGER_PARTY_TYPES.has(payment.party.type)) {
                    const balanceChange = getPaymentBalanceDelta(
                        asSupportedPartyType(payment.party.type), payment.direction, payment.amount.toNumber()
                    );
                    await tx.party.update({
                        where: { id: payment.partyId },
                        data: { currentBalance: { decrement: balanceChange } },
                    });
                }
                if (payment.accountId) {
                    const bankBalanceChange = isContra
                        ? -payment.amount.toNumber()
                        : (payment.direction === "INCOMING" ? payment.amount.toNumber() : -payment.amount.toNumber());
                    await tx.bankAccount.update({
                        where: { id: payment.accountId },
                        data: { currentBalance: { decrement: bankBalanceChange } },
                    });
                }
                if (payment.destinationAccountId) {
                    await tx.bankAccount.update({
                        where: { id: payment.destinationAccountId },
                        data: { currentBalance: { decrement: payment.amount.toNumber() } },
                    });
                }
                await tx.journalEntry.updateMany({
                    where: { paymentId: payment.id, tenantId },
                    data: { isBalanced: false, syncState: "MODIFIED" },
                });
            }

            const deletedPayment = await tx.payment.update({
                where: { id: payment.id },
                data: { isDeleted: true },
            });

            await tx.auditLog.create({
                data: {
                    tenantId, entityType: "Payment", entityId: deletedPayment.id,
                    userId: userId || payment.createdBy, action: "DELETE",
                    fieldName: "isDeleted",
                    oldValue: JSON.stringify(false),
                    newValue: JSON.stringify(true),
                },
            });

            return deletedPayment;
        }, { isolationLevel: "RepeatableRead" });

        return NextResponse.json({ success: true, payment: result });
    } catch (error) {
        logError("payments.delete.error", { requestId: reqId, error });
        const msg = error instanceof Error ? error.message : "Failed to delete payment";
        return NextResponse.json({ error: msg }, { status: 400 });
    }
}
