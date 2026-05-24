import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword, hashPassword } from "@/lib/auth";
import { logError, logInfo, getRequestId } from "@/lib/observability";
import { resolveSuperAdminSession } from "@/lib/session-server";

// POST /api/admin/change-password
// body: { currentPassword, newPassword }
// Lets a logged-in superadmin change their own password. No email reset link;
// the caller must prove possession of the current password.
export async function POST(request: NextRequest) {
  const session = await resolveSuperAdminSession(request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { currentPassword?: unknown; newPassword?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const current = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const next = typeof body.newPassword === "string" ? body.newPassword : "";

  if (!current || !next) {
    return NextResponse.json({ error: "currentPassword and newPassword are required" }, { status: 400 });
  }
  if (next.length < 10) {
    return NextResponse.json({ error: "New password must be at least 10 characters" }, { status: 400 });
  }
  if (current === next) {
    return NextResponse.json({ error: "New password must differ from current" }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, password: true, tenantId: true },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const ok = await comparePassword(current, user.password);
    if (!ok) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    const hashed = await hashPassword(next);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });
    // Invalidate any outstanding reset tokens — the caller now knows the password.
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        entityType: "User",
        entityId: user.id,
        userId: user.id,
        action: "PASSWORD_CHANGED",
        actorType: "SYSTEM",
      },
    });
    logInfo("admin.change-password.success", {
      requestId: getRequestId(request),
      userId: user.id,
    });

    return NextResponse.json({ data: { changed: true } });
  } catch (error) {
    logError("admin.change-password.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
