import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError, getRequestId } from "@/lib/observability";
import { resolveSuperAdminSession } from "@/lib/session-server";

// POST /api/admin/tenants/[id]/suspend  body: { suspend: boolean }
// Suspending deactivates every user in the tenant; un-suspending reactivates them.
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await resolveSuperAdminSession(request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  let body: { suspend?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const suspend = body.suspend === true;

  try {
    const tenant = await prisma.tenant.findUnique({ where: { id }, select: { id: true } });
    if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const result = await prisma.user.updateMany({
      where: { tenantId: id, role: { not: "SUPERADMIN" } },
      data: { isActive: !suspend },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: id,
        entityType: "Tenant",
        entityId: id,
        userId: session.userId,
        action: suspend ? "SUSPEND" : "UNSUSPEND",
        newValue: JSON.stringify({ affectedUsers: result.count }),
        actorType: "SYSTEM",
      },
    });

    return NextResponse.json({ data: { suspended: suspend, affectedUsers: result.count } });
  } catch (error) {
    logError("admin.tenants.suspend.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
