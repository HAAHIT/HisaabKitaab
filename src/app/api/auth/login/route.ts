import { prisma } from "@/lib/prisma";
import { comparePassword, createSession } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import {
  assertLoginAllowed,
  clearLoginFailures,
  recordLoginFailure,
} from "@/lib/login-rate-limit";
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

function jsonWithRequestId(
  requestId: string,
  body: unknown,
  status: number,
  extraHeaders?: Record<string, string>
) {
  const response = NextResponse.json(body, { status });

  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) {
      response.headers.set(key, value);
    }
  }

  return attachRequestIdHeader(response, requestId);
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const clientIp = getClientIp(request);

  try {
    const body = await request.json();
    const credential =
      typeof body.credential === "string" ? body.credential.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!credential || !password) {
      logWarn("auth.login.validation_failed", {
        requestId,
        clientIp,
      });

      return jsonWithRequestId(
        requestId,
        { error: "Email/phone and password are required" },
        400
      );
    }

    const throttleStatus = await assertLoginAllowed(prisma, {
      credential,
      ip: clientIp,
    });

    if (!throttleStatus.allowed) {
      logWarn("auth.login.throttled", {
        requestId,
        clientIp,
        retryAfterSeconds: throttleStatus.retryAfterSeconds,
      });

      return jsonWithRequestId(
        requestId,
        { error: "Too many login attempts. Try again later." },
        429,
        { "Retry-After": String(throttleStatus.retryAfterSeconds) }
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
    });

    if (!user) {
      await recordLoginFailure(prisma, {
        credential,
        ip: clientIp,
      });
      logWarn("auth.login.failed", {
        requestId,
        clientIp,
        reason: "unknown_user",
      });

      return jsonWithRequestId(
        requestId,
        { error: "Invalid email or password" },
        401
      );
    }

    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      const failure = await recordLoginFailure(prisma, {
        credential,
        ip: clientIp,
        userId: user.id,
      });
      logWarn("auth.login.failed", {
        requestId,
        clientIp,
        userId: user.id,
        reason: "invalid_password",
        retryAfterSeconds: failure.retryAfterSeconds || undefined,
      });

      return jsonWithRequestId(
        requestId,
        { error: "Invalid email or password" },
        401
      );
    }

    await clearLoginFailures(prisma, {
      credential,
      ip: clientIp,
    });

    await createSession({
      userId: user.id,
      name: user.name,
      role: user.role,
      email: user.email || undefined,
      phone: user.phone || undefined,
    });

    logInfo("auth.login.succeeded", {
      requestId,
      clientIp,
      userId: user.id,
      role: user.role,
    });

    return jsonWithRequestId(
      requestId,
      {
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          email: user.email,
          phone: user.phone,
        },
      },
      200
    );
  } catch (error) {
    logError("auth.login.error", {
      requestId,
      clientIp,
      error,
    });
    return jsonWithRequestId(
      requestId,
      { error: "Internal server error" },
      500
    );
  }
}
