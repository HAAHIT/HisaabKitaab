import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError, logInfo, getRequestId } from "@/lib/observability";
import { resolveSuperAdminSession } from "@/lib/session-server";
import { signToken, IMPERSONATION_DURATION } from "@/lib/auth";
import { SESSION_COOKIE_NAME } from "@/lib/cookie";

// POST /api/admin/tenants/[id]/impersonate  body: { userId?: string }
// Issues a short-lived session for the target user; SUPERADMIN's session is
// replaced by the impersonation token, which carries impersonatedBy=<superadminId>
// so /api/admin/exit-impersonation can restore the original session.
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await resolveSuperAdminSession(request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: tenantId } = await context.params;
  let body: { userId?: unknown; readOnly?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // body is optional
  }
  const requestedUserId = typeof body.userId === "string" && body.userId.trim() ? body.userId.trim() : null;
  const readOnly = body.readOnly !== false; // default: read-only unless explicitly set false

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true },
    });
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

    const targetUser = requestedUserId
      ? await prisma.user.findFirst({
          where: { id: requestedUserId, tenantId, isActive: true, role: { not: "SUPERADMIN" } },
          select: { id: true, name: true, role: true, email: true, phone: true, tenantId: true },
        })
      : await prisma.user.findFirst({
          where: { tenantId, isActive: true, role: "ADMIN" },
          orderBy: { createdAt: "asc" },
          select: { id: true, name: true, role: true, email: true, phone: true, tenantId: true },
        });

    if (!targetUser) {
      return NextResponse.json(
        { error: requestedUserId ? "User not found or ineligible" : "No active ADMIN found in this tenant" },
        { status: 404 }
      );
    }
    if (targetUser.role === "SUPERADMIN") {
      return NextResponse.json({ error: "Cannot impersonate another superadmin" }, { status: 400 });
    }

    const token = await signToken(
      {
        userId: targetUser.id,
        tenantId: targetUser.tenantId,
        name: targetUser.name,
        role: targetUser.role,
        email: targetUser.email ?? undefined,
        phone: targetUser.phone ?? undefined,
        impersonatedBy: session.userId,
        impersonatedAt: Math.floor(Date.now() / 1000),
        readOnly,
      },
      IMPERSONATION_DURATION
    );

    await prisma.auditLog.create({
      data: {
        tenantId,
        entityType: "User",
        entityId: targetUser.id,
        userId: session.userId,
        action: "IMPERSONATION_START",
        newValue: JSON.stringify({ targetRole: targetUser.role, durationSec: IMPERSONATION_DURATION, readOnly }),
        actorType: "SYSTEM",
      },
    });
    logInfo("admin.impersonation.start", {
      requestId: getRequestId(request),
      superadminId: session.userId,
      targetUserId: targetUser.id,
      tenantId,
    });

    const response = NextResponse.json({
      data: {
        targetUserId: targetUser.id,
        targetName: targetUser.name,
        targetRole: targetUser.role,
        tenantId,
        tenantName: tenant.name,
        expiresInSeconds: IMPERSONATION_DURATION,
        redirectTo: "/dashboard",
      },
    });
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: IMPERSONATION_DURATION,
      path: "/",
    });
    return response;
  } catch (error) {
    logError("admin.impersonation.start.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
