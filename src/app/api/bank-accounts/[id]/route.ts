import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveWriteSession } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";

export const runtime = "nodejs";

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const reqId = getRequestId(request);
    const { id } = await params;

    try {
        const tenantResolution = await resolveWriteSession(request);
        if (!tenantResolution.ok) {
            return tenantResolution.response;
        }
        const tenantId = tenantResolution.session.tenantId;
        const userId = tenantResolution.session.userId;
        const role = tenantResolution.session.role;

        if (role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const account = await prisma.bankAccount.findFirst({
            where: { id, tenantId, isDeleted: false },
        });

        if (!account) {
            return NextResponse.json({ error: "Account not found" }, { status: 404 });
        }

        const deletedAccount = await prisma.bankAccount.update({
            where: { id: account.id },
            data: {
                isActive: false,
                isDeleted: true,
            },
        });

        // Audit Log
        await prisma.auditLog.create({
            data: {
                tenantId,
                entityType: "BankAccount",
                entityId: deletedAccount.id,
                userId: userId || deletedAccount.createdBy,
                action: "DELETE",
                fieldName: "isDeleted",
                oldValue: JSON.stringify(false),
                newValue: JSON.stringify(true),
            },
        });

        return NextResponse.json({ success: true, account: deletedAccount });
    } catch (error) {
        logError("bankAccounts.delete.error", { requestId: reqId, error });
        const msg = error instanceof Error ? error.message : "Failed to delete account";
        return NextResponse.json({ error: msg }, { status: 400 });
    }
}
