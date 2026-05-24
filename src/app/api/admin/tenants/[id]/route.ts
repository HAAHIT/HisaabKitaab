import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError, getRequestId } from "@/lib/observability";
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
