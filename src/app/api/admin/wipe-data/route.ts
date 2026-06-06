import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSession } from "@/lib/api-tenant";
import { logInfo, logError, getRequestId } from "@/lib/observability";
import { checkRateLimit } from "@/lib/api-rate-limit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  // Server-only flag. The matching NEXT_PUBLIC_* variable still controls
  // whether the button renders in the UI, but the actual destructive gate
  // must not be readable from the client bundle — otherwise the flag's
  // state is itself a leaked secret about the deployment.
  if (process.env.FEATURE_TESTING_WIPE_DATA !== "true") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, role } = sessionResolution.session;

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Tight cap — wiping tenant data is irreversible. 2/min/tenant is plenty for
  // legitimate test flows and prevents any kind of accidental loop.
  const rl = await checkRateLimit(request, `wipe-data:${tenantId}`, 2);
  if (rl) return rl;

  const reqId = getRequestId(request);

  try {
    await prisma.$transaction(async (tx) => {
      // Children first (FK order)
      await tx.journalLine.deleteMany({ where: { journal: { tenantId } } });
      await tx.bankStatementRow.deleteMany({ where: { tenantId } });
      await tx.bankStatement.deleteMany({ where: { tenantId } });
      await tx.measurementPhoto.deleteMany({ where: { measurement: { tenantId } } });
      await tx.measurementUpload.deleteMany({ where: { tenantId } });
      await tx.journalEntry.deleteMany({ where: { tenantId } });
      await tx.payment.deleteMany({ where: { tenantId } });
      await tx.bill.deleteMany({ where: { tenantId } });
      await tx.bankAccount.deleteMany({ where: { tenantId } });
      await tx.party.deleteMany({ where: { tenantId } });
      await tx.billTemplate.deleteMany({ where: { tenantId } });
      await tx.itemCatalog.deleteMany({ where: { tenantId } });
      await tx.importJob.deleteMany({ where: { tenantId } });

      // AuditLog has an immutability trigger — disable it for the wipe, then re-enable
      await tx.$executeRawUnsafe(`ALTER TABLE "AuditLog" DISABLE TRIGGER enforce_audit_immutability;`);
      await tx.auditLog.deleteMany({ where: { tenantId } });
      await tx.$executeRawUnsafe(`ALTER TABLE "AuditLog" ENABLE TRIGGER enforce_audit_immutability;`);
    });

    logInfo("admin.wipe-data.completed", { requestId: reqId, tenantId });

    return NextResponse.json({ wiped: true });
  } catch (err) {
    logError("admin.wipe-data.error", { requestId: reqId, tenantId, error: err });
    return NextResponse.json({ error: "Failed to wipe data" }, { status: 500 });
  }
}
