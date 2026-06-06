import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError, logInfo, getRequestId } from "@/lib/observability";
import { resolveSuperAdminSession } from "@/lib/session-server";
import { publicUrl } from "@/lib/public-url";
import { sendMail } from "@/lib/mail";
import { buildPasswordResetEmail } from "@/lib/mail-templates";
import { checkRateLimit } from "@/lib/api-rate-limit";

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

  // Cap superadmin-initiated resets to 20/min — prevents a compromised superadmin
  // session from being used to flood reset emails (which would burn MSG91 quota
  // and could be flagged as abuse by the provider).
  const rl = await checkRateLimit(request, `admin:reset-password:${session.userId}`, 20);
  if (rl) return rl;

  const { id } = await context.params;

  let body: { sendEmail?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // empty body OK — defaults to sendEmail=false
  }
  const sendEmail = body.sendEmail === true;

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

    const resetUrl = publicUrl(request, "/reset-password");
    resetUrl.searchParams.set("token", rawToken);

    logInfo("admin.users.reset-password.issued", {
      requestId: getRequestId(request),
      issuedBy: session.userId,
      userId: user.id,
      expiresAt: expiresAt.toISOString(),
    });

    let emailDelivered = false;
    let emailReason: string | undefined;
    if (sendEmail) {
      if (!user.email) {
        emailReason = "user_has_no_email";
      } else {
        const { subject, text, html } = buildPasswordResetEmail({
          recipientName: user.name,
          resetUrl: resetUrl.toString(),
          expiresAt,
          initiatedByAdmin: true,
        });
        const mailResult = await sendMail({
          to: user.email,
          subject,
          text,
          html,
          event: "auth.password-reset.admin",
        });
        emailDelivered = mailResult.delivered;
        emailReason = mailResult.reason;
      }
    }

    return NextResponse.json({
      data: {
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        resetUrl: resetUrl.toString(),
        expiresAt: expiresAt.toISOString(),
        emailDelivered,
        emailReason,
      },
    });
  } catch (error) {
    logError("admin.users.reset-password.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
