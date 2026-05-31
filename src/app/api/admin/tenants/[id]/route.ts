import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError, logInfo, getRequestId } from "@/lib/observability";
import { resolveSuperAdminSession } from "@/lib/session-server";

const ALLOWED_PLANS = ["FREE", "PRO"] as const;
type Plan = (typeof ALLOWED_PLANS)[number];

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await resolveSuperAdminSession(request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (typeof body.name === "string") {
    const v = body.name.trim();
    if (!v) return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
    data.name = v;
  }
  if (body.email !== undefined) {
    const v = typeof body.email === "string" ? body.email.trim() : "";
    data.email = v || null;
  }
  if (body.phone !== undefined) {
    const v = typeof body.phone === "string" ? body.phone.trim() : "";
    data.phone = v || null;
  }
  if (body.gstin !== undefined) {
    const v = typeof body.gstin === "string" ? body.gstin.trim().toUpperCase() : "";
    data.gstin = v || null;
  }
  if (body.plan !== undefined) {
    if (typeof body.plan !== "string" || !ALLOWED_PLANS.includes(body.plan as Plan)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }
    data.plan = body.plan;
  }
  if (body.isOnboardingComplete !== undefined) {
    data.isOnboardingComplete = !!body.isOnboardingComplete;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No changes" }, { status: 400 });
  }

  try {
    const tenant = await prisma.tenant.findUnique({ where: { id }, select: { id: true } });
    if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await prisma.tenant.update({
      where: { id },
      data,
      select: {
        id: true, name: true, slug: true, plan: true, email: true, phone: true,
        gstin: true, isOnboardingComplete: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: id,
        entityType: "Tenant",
        entityId: id,
        userId: session.userId,
        action: "UPDATE",
        newValue: JSON.stringify(data),
        actorType: "SYSTEM",
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    logError("admin.tenants.update.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── DELETE — Destructive wipe of a tenant and all its data ─────────────────
// Gated by FEATURE_TESTING_DELETE_TENANT to ensure this can't be enabled by
// accident in production. SUPERADMIN-only. Use this to nuke test signups.
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (process.env.FEATURE_TESTING_DELETE_TENANT !== "true") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const session = await resolveSuperAdminSession(request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const reqId = getRequestId(request);

  try {
    const tenant = await prisma.tenant.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      // Children first (FK order)
      await tx.journalLine.deleteMany({ where: { journal: { tenantId: id } } });
      await tx.bankStatementRow.deleteMany({ where: { tenantId: id } });
      await tx.bankStatement.deleteMany({ where: { tenantId: id } });
      await tx.measurementPhoto.deleteMany({ where: { measurement: { tenantId: id } } });
      await tx.measurementUpload.deleteMany({ where: { tenantId: id } });
      await tx.journalEntry.deleteMany({ where: { tenantId: id } });
      await tx.payment.deleteMany({ where: { tenantId: id } });
      await tx.bill.deleteMany({ where: { tenantId: id } });
      await tx.bankAccount.deleteMany({ where: { tenantId: id } });
      await tx.party.deleteMany({ where: { tenantId: id } });
      await tx.billTemplate.deleteMany({ where: { tenantId: id } });
      await tx.itemCatalog.deleteMany({ where: { tenantId: id } });
      await tx.importJob.deleteMany({ where: { tenantId: id } });
      await tx.passwordResetToken.deleteMany({ where: { user: { tenantId: id } } });
      await tx.authThrottle.deleteMany({ where: { user: { tenantId: id } } });

      // AuditLog has an immutability trigger — disable it for the wipe
      await tx.$executeRawUnsafe(`ALTER TABLE "AuditLog" DISABLE TRIGGER enforce_audit_immutability;`);
      await tx.auditLog.deleteMany({ where: { tenantId: id } });
      await tx.$executeRawUnsafe(`ALTER TABLE "AuditLog" ENABLE TRIGGER enforce_audit_immutability;`);

      await tx.user.deleteMany({ where: { tenantId: id } });
      await tx.tenant.delete({ where: { id } });
    });

    logInfo("admin.tenants.delete.completed", { requestId: reqId, tenantId: id, tenantName: tenant.name, deletedBy: session.userId });

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    logError("admin.tenants.delete.error", { requestId: reqId, tenantId: id, error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
