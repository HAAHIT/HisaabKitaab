import { prisma } from "@/lib/prisma";
import { comparePassword, createSession } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

// Pre-computed bcrypt hash used to equalise timing when the requested
// account does not exist — without it, "unknown user" returns in ~10ms while
// "wrong password" runs the bcrypt comparison and returns in ~150-200ms,
// letting an attacker enumerate valid credentials by latency. The plaintext
// of this hash is unknown to anyone, so it can never match a real password.
const TIMING_EQUALISATION_HASH =
  "$2a$12$0000000000000000000000000000000000000000000000000000u";
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
import { resolvePublicTenant } from "@/lib/api-tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LoginRequestBody = {
  credential: string;
  password: string;
};

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

function redirectWithRequestId(requestId: string, url: URL, status = 303) {
  return attachRequestIdHeader(NextResponse.redirect(url, { status }), requestId);
}

function getLoginErrorUrl(request: NextRequest, errorCode: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", errorCode);
  return url;
}

function getPostLoginUrl(request: NextRequest, role: string) {
  return new URL(
    role === "CUSTOMER" ? "/measurements/upload" : "/dashboard",
    request.url
  );
}

function isFormSubmission(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  return (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  );
}

async function readLoginRequestBody(
  request: NextRequest
): Promise<LoginRequestBody> {
  if (isFormSubmission(request)) {
    const formData = await request.formData();

    return {
      credential: String(formData.get("credential") || "").trim(),
      password: String(formData.get("password") || ""),
    };
  }

  const body = await request.json();

  return {
    credential: typeof body.credential === "string" ? body.credential.trim() : "",
    password: typeof body.password === "string" ? body.password : "",
  };
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const clientIp = getClientIp(request);
  const formSubmission = isFormSubmission(request);

  try {
    const { credential, password } = await readLoginRequestBody(request);
    const tenantResolution = await resolvePublicTenant(request);
    if (!tenantResolution.ok) {
      logError("auth.login.tenant_missing", {
        requestId,
        clientIp,
      });
      return attachRequestIdHeader(tenantResolution.response, requestId);
    }
    const tenantId = tenantResolution.tenantId;

    if (!credential || !password) {
      logWarn("auth.login.validation_failed", {
        requestId,
        clientIp,
      });

      if (formSubmission) {
        return redirectWithRequestId(
          requestId,
          getLoginErrorUrl(request, "missing_credentials")
        );
      }

      return jsonWithRequestId(requestId, { error: "Email/phone and password are required" }, 400);
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

      if (formSubmission) {
        return redirectWithRequestId(
          requestId,
          getLoginErrorUrl(request, "throttled")
        );
      }

      return jsonWithRequestId(requestId, { error: "Too many login attempts. Try again later." }, 429, {
        "Retry-After": String(throttleStatus.retryAfterSeconds),
      });
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
      // Run a throwaway bcrypt compare so the response latency matches the
      // "wrong password" path and an attacker cannot enumerate valid accounts.
      await comparePassword(password, TIMING_EQUALISATION_HASH);
      await recordLoginFailure(prisma, {
        credential,
        ip: clientIp,
      });
      logWarn("auth.login.failed", {
        requestId,
        clientIp,
        reason: "unknown_user",
      });

      if (formSubmission) {
        return redirectWithRequestId(
          requestId,
          getLoginErrorUrl(request, "invalid_credentials")
        );
      }

      return jsonWithRequestId(requestId, { error: "Invalid email or password" }, 401);
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

      if (formSubmission) {
        return redirectWithRequestId(
          requestId,
          getLoginErrorUrl(request, "invalid_credentials")
        );
      }

      return jsonWithRequestId(requestId, { error: "Invalid email or password" }, 401);
    }

    await clearLoginFailures(prisma, {
      credential,
      ip: clientIp,
    });

    await createSession({
      userId: user.id,
      tenantId: user.tenantId,
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

    const postLoginUrl = getPostLoginUrl(request, user.role);

    if (formSubmission) {
      return redirectWithRequestId(requestId, postLoginUrl);
    }

    return jsonWithRequestId(requestId, {
      redirectTo: postLoginUrl,
      user: {
        id: user.id,
        tenantId: user.tenantId,
        name: user.name,
        role: user.role,
        email: user.email,
        phone: user.phone,
      },
    }, 200);
  } catch (error) {
    logError("auth.login.error", {
      requestId,
      clientIp,
      error,
    });

    if (formSubmission) {
      return redirectWithRequestId(
        requestId,
        getLoginErrorUrl(request, "server_error")
      );
    }

    return jsonWithRequestId(requestId, { error: "Internal server error" }, 500);
  }
}
