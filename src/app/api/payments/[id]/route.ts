import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveWriteTenant } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";
import { getPaymentBalanceDelta } from "@/lib/accounting";

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
