import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveWriteTenant } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";
import { getPaymentBalanceDelta } from "@/lib/accounting";
import {
    journalForPaymentReceived,
    journalForPaymentMade,
    journalForContraEntry,
} from "@/lib/journal";

function generateLockKey(tenantId: string): bigint {
    const hash = crypto.createHash("sha256").update(tenantId).digest("hex");
    return BigInt("0x" + hash.substring(0, 15));
}

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
    const role = request.headers.get("x-user-role");
    const userId = request.headers.get("x-user-id");

    if (!role || role === "CUSTOMER") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!userId) {
        return NextResponse.json({ error: "Missing user context" }, { status: 401 });
    }

    try {
        const tenantResolution = await resolveWriteTenant(request);
        if (!tenantResolution.ok) return tenantResolution.response;
        const tenantId = tenantResolution.tenantId;

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
                if (payment.party && payment.partyId) {
                    const oldDelta = getPaymentBalanceDelta(
                        payment.party.type, payment.direction, payment.amount.toNumber()
                    );
                    await tx.party.update({
                        where: { id: payment.partyId },
                        data: { currentBalance: { decrement: oldDelta } },
                    });
                }
                if (payment.accountId) {
                    const oldBankDelta = payment.direction === "INCOMING"
                        ? payment.amount.toNumber() : -payment.amount.toNumber();
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
                await tx.journalEntry.deleteMany({ where: { paymentId: id, tenantId } });
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
                if (!isContra && newParty) {
                    const newDelta = getPaymentBalanceDelta(newParty.type, newDirection, newAmount);
                    await tx.party.update({
                        where: { id: newParty.id },
                        data: { currentBalance: { increment: newDelta } },
                    });
                }
                if (newAccountId) {
                    const newBankDelta = newDirection === "INCOMING" ? newAmount : -newAmount;
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

                if (isContra) {
                    const sourceAcc = await tx.bankAccount.findUnique({ where: { id: newAccountId! }, select: { type: true } });
                    const destAcc = await tx.bankAccount.findUnique({ where: { id: newDestId! }, select: { type: true } });
                    await journalForContraEntry(tx, tenantId, {
                        id: updated.id, partyId: null, partyName: null,
                        amount: newAmount, mode: newMode, date: newDate, createdBy: payment.createdBy,
                        sourceAccountType: sourceAcc?.type, destAccountType: destAcc?.type,
                    } as any);
                } else if (newParty) {
                    const journalArgs = {
                        id: updated.id, partyId: newParty.id, partyName: newParty.name,
                        amount: newAmount, mode: newMode, date: newDate, createdBy: payment.createdBy,
                    };
                    if (newDirection === "INCOMING") {
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

    try {
        const tenantResolution = await resolveWriteTenant(request);
        if (!tenantResolution.ok) {
            return tenantResolution.response;
        }
        const tenantId = tenantResolution.tenantId;
        const userId = request.headers.get("x-user-id");

        const result = await prisma.$transaction(async (tx) => {
            const payment = await tx.payment.findFirst({
                where: { id, tenantId, isDeleted: false },
                include: { party: true },
            });

            if (!payment) {
                throw new Error("Payment not found");
            }

            // Revert balances if the payment was completed
            if (payment.status === "COMPLETED") {
                if (payment.party) {
                    const balanceChange = getPaymentBalanceDelta(
                        payment.party.type,
                        payment.direction,
                        payment.amount.toNumber()
                    );

                    await tx.party.update({
                        where: { id: payment.partyId! },
                        data: {
                            currentBalance: { decrement: balanceChange },
                        },
                    });
                }

                if (payment.accountId) {
                    const bankBalanceChange = payment.direction === "INCOMING" ? payment.amount.toNumber() : -payment.amount.toNumber();
                    await tx.bankAccount.update({
                        where: { id: payment.accountId },
                        data: {
                            currentBalance: { decrement: bankBalanceChange },
                        },
                    });
                }

                if (payment.destinationAccountId) {
                    // Reverse Contra Entry destination money
                    await tx.bankAccount.update({
                        where: { id: payment.destinationAccountId },
                        data: {
                            currentBalance: { decrement: payment.amount.toNumber() },
                        },
                    });
                }

                // Hard delete associated JournalEntries
                await tx.journalEntry.deleteMany({
                    where: { paymentId: payment.id, tenantId },
                });
            }

            // Mark payment as deleted
            const deletedPayment = await tx.payment.update({
                where: { id: payment.id },
                data: {
                    isDeleted: true,
                },
            });

            // Audit Log
            await tx.auditLog.create({
                data: {
                    tenantId,
                    entityType: "Payment",
                    entityId: deletedPayment.id,
                    userId: userId || payment.createdBy,
                    action: "DELETE",
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
