import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveWriteSession } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";
import { FEATURE_FLAGS } from "@/lib/feature-flags";

export async function DELETE(request: NextRequest) {
    try {
        if (!FEATURE_FLAGS.testingWipeData) {
            return NextResponse.json({ error: "Feature disabled" }, { status: 404 });
        }

        const sessionResolution = await resolveWriteSession(request);
        if (!sessionResolution.ok) return sessionResolution.response;
        const { tenantId, role } = sessionResolution.session;

        if (role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await prisma.$transaction(async (tx) => {
            await tx.journalLine.deleteMany({ where: { journal: { tenantId } } });
            await tx.journalEntry.deleteMany({ where: { tenantId } });
            await tx.payment.deleteMany({ where: { tenantId } });
            await tx.bill.deleteMany({ where: { tenantId } });
            await tx.measurementPhoto.deleteMany({ where: { measurement: { tenantId } } });
            await tx.measurementUpload.deleteMany({ where: { tenantId } });
            await tx.importJob.deleteMany({ where: { tenantId } });
            await tx.itemCatalog.deleteMany({ where: { tenantId } });

            // Temporarily disable the immutability trigger to allow testing wipes
            await tx.$executeRawUnsafe(`ALTER TABLE "AuditLog" DISABLE TRIGGER enforce_audit_immutability;`);
            await tx.auditLog.deleteMany({ where: { tenantId } });
            await tx.$executeRawUnsafe(`ALTER TABLE "AuditLog" ENABLE TRIGGER enforce_audit_immutability;`);

            await tx.party.deleteMany({ where: { tenantId } });
            await tx.bankAccount.deleteMany({ where: { tenantId } });
        });

        return NextResponse.json({ success: true, message: "Data wiped successfully" });
    } catch (error) {
        logError("settings.wipe-data.error", { requestId: getRequestId(request), error });
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
