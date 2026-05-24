import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError, logInfo, getRequestId } from "@/lib/observability";
import { resolveSuperAdminSession } from "@/lib/session-server";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour — operator-initiated, slightly longer than self-serve

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// POST /api/admin/users/[id]/reset-password
// Issues a one-time password reset token for any user and returns the URL to share manually.
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await resolveSuperAdminSession(request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, tenantId: true, role: true },
    });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    await prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });
    });

    await prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        entityType: "User",
        entityId: user.id,
        userId: session.userId,
        action: "PASSWORD_RESET_ISSUED",
        actorType: "SYSTEM",
      },
    });

    const resetUrl = new URL("/reset-password", request.url);
    resetUrl.searchParams.set("token", rawToken);

    logInfo("admin.users.reset-password.issued", {
      requestId: getRequestId(request),
      issuedBy: session.userId,
      userId: user.id,
      expiresAt: expiresAt.toISOString(),
    });

    return NextResponse.json({
      data: {
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        resetUrl: resetUrl.toString(),
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error) {
    logError("admin.users.reset-password.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
