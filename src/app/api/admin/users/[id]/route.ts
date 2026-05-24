import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError, getRequestId } from "@/lib/observability";
import { resolveSuperAdminSession } from "@/lib/session-server";

// PATCH /api/admin/users/[id]  body: { isActive?: boolean }
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await resolveSuperAdminSession(request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  if (id === session.userId) {
    return NextResponse.json({ error: "Cannot modify your own account here" }, { status: 400 });
  }

  let body: { isActive?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: { isActive?: boolean } = {};
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No changes" }, { status: 400 });
  }

  try {
    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, tenantId: true, role: true },
    });
    if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (target.role === "SUPERADMIN") {
      return NextResponse.json(
        { error: "Manage superadmins from /admin/superadmins" },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, isActive: true, role: true },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: target.tenantId,
        entityType: "User",
        entityId: id,
        userId: session.userId,
        action: "UPDATE",
        newValue: JSON.stringify(data),
        actorType: "SYSTEM",
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    logError("admin.users.update.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
