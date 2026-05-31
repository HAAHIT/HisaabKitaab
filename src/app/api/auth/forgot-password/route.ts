import crypto from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { publicUrl } from "@/lib/public-url";
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

const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function buildResetUrl(request: NextRequest, token: string) {
  const url = publicUrl(request, "/reset-password");
  url.searchParams.set("token", token);
  return url.toString();
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const clientIp = getClientIp(request);

  const rateLimitResponse = await checkRateLimit(request, "auth.forgot-password", 5);
  if (rateLimitResponse) return rateLimitResponse;

  // Always respond with the same generic message to prevent account enumeration.
  const genericResponse = NextResponse.json(
    {
      message:
        "If an account matches the provided email or phone, a password reset link has been sent.",
    },
    { status: 200 }
  );

  try {
    const body = await request.json().catch(() => ({}));
    const credential =
      typeof body.credential === "string" ? body.credential.trim() : "";

    if (!credential) {
      return attachRequestIdHeader(
        NextResponse.json({ error: "Email or phone is required" }, { status: 400 }),
        requestId
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        isActive: true,
        OR: [
          { email: { equals: credential, mode: "insensitive" } },
          { phone: credential },
        ],
      },
      select: { id: true, email: true, phone: true },
    });

    if (!user) {
      logWarn("auth.forgot-password.unknown_credential", { requestId, clientIp });
      return attachRequestIdHeader(genericResponse, requestId);
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    await prisma.$transaction(async (tx) => {
      // Invalidate any prior unused tokens for this user.
      await tx.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });
    });

    const resetUrl = buildResetUrl(request, rawToken);

    // TODO: integrate transactional email provider. For now the link is returned
    // in dev for testing. Never log the raw token or resetUrl in production.
    logInfo("auth.forgot-password.token_issued", {
      requestId,
      clientIp,
      userId: user.id,
      expiresAt: expiresAt.toISOString(),
    });

    if (process.env.NODE_ENV !== "production") {
      return attachRequestIdHeader(
        NextResponse.json(
          {
            message:
              "Password reset link generated. Email delivery is not configured; use the link below.",
            resetUrl,
            expiresAt: expiresAt.toISOString(),
          },
          { status: 200 }
        ),
        requestId
      );
    }

    return attachRequestIdHeader(genericResponse, requestId);
  } catch (error) {
    logError("auth.forgot-password.error", { requestId, clientIp, error });
    return attachRequestIdHeader(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      requestId
    );
  }
}
