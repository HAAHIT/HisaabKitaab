import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSession } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";
import { mergeTenantSettings } from "@/lib/tenant-settings";

export const runtime = "nodejs";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const reqId = getRequestId(request);
    const { id } = await params;

    try {
        const tenantResolution = await resolveSession(request);
        if (!tenantResolution.ok) return tenantResolution.response;
        const { tenantId, userId, role } = tenantResolution.session;

        if (role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const account = await prisma.bankAccount.findFirst({
            where: { id, tenantId, isDeleted: false },
        });

        if (!account) {
            return NextResponse.json({ error: "Account not found" }, { status: 404 });
        }

        const body = await request.json() as { isDefault?: boolean };

        if (body.isDefault === true) {
            // Fetch current tenant settings to merge into
            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId },
                select: { settings: true },
            });

            const updatedSettings = mergeTenantSettings(tenant?.settings, {
                bankName: account.name,
                bankAccountNumber: account.accountNumber ?? null,
                bankIfscCode: account.ifscCode ?? null,
                bankBranch: null,
            });

            await prisma.$transaction([
                prisma.bankAccount.updateMany({
                    where: { tenantId, isDeleted: false },
                    data: { isDefault: false },
                }),
                prisma.bankAccount.update({
                    where: { id },
                    data: { isDefault: true },
                }),
                prisma.tenant.update({
                    where: { id: tenantId },
                    data: { settings: updatedSettings },
                }),
            ]);

            await prisma.auditLog.create({
                data: {
                    tenantId,
                    entityType: "BankAccount",
                    entityId: id,
                    userId: userId || account.createdBy,
                    action: "UPDATE",
                    fieldName: "isDefault",
                    oldValue: JSON.stringify(false),
                    newValue: JSON.stringify(true),
                },
            });

            const updated = await prisma.bankAccount.findUnique({ where: { id } });
            return NextResponse.json({ success: true, account: updated });
        }

        return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    } catch (error) {
        logError("bankAccounts.patch.error", { requestId: reqId, error });
        const msg = error instanceof Error ? error.message : "Failed to update account";
        return NextResponse.json({ error: msg }, { status: 400 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const reqId = getRequestId(request);
    const { id } = await params;

    try {
        const tenantResolution = await resolveSession(request);
        if (!tenantResolution.ok) return tenantResolution.response;
        const { tenantId, userId, role } = tenantResolution.session;

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
