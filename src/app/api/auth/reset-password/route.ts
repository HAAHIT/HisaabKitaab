import crypto from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { checkRateLimit } from "@/lib/api-rate-limit";
import {
  attachRequestIdHeader,
  getClientIp,
  getRequestId,
  logError,
  logInfo,
  logWarn,
} from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const clientIp = getClientIp(request);

  const rateLimitResponse = await checkRateLimit(request, "auth.reset-password", 10);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!token || !password) {
      return attachRequestIdHeader(
        NextResponse.json({ error: "Token and new password are required" }, { status: 400 }),
        requestId
      );
    }

    if (password.length < 12) {
      return attachRequestIdHeader(
        NextResponse.json({ error: "Password must be at least 12 characters" }, { status: 400 }),
        requestId
      );
    }

    const tokenHash = hashToken(token);
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
      },
    });

    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      logWarn("auth.reset-password.invalid_token", {
        requestId,
        clientIp,
        reason: !record ? "not_found" : record.usedAt ? "already_used" : "expired",
      });
      return attachRequestIdHeader(
        NextResponse.json({ error: "Reset link is invalid or has expired" }, { status: 400 }),
        requestId
      );
    }

    const hashedPassword = await hashPassword(password);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: record.userId },
        data: { password: hashedPassword },
      });
      await tx.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });
      // Invalidate any other outstanding tokens for the same user.
      await tx.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: new Date() },
      });
    });

    logInfo("auth.reset-password.succeeded", {
      requestId,
      clientIp,
      userId: record.userId,
    });

    return attachRequestIdHeader(
      NextResponse.json({ message: "Password updated successfully" }, { status: 200 }),
      requestId
    );
  } catch (error) {
    logError("auth.reset-password.error", { requestId, clientIp, error });
    return attachRequestIdHeader(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      requestId
    );
  }
}
