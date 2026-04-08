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
import { resolveReadTenant } from "@/lib/api-tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LoginRequestBody = {
  credential: string;
  password: string;
};

/**
 * Create a JSON NextResponse with the provided body and status, attach the request ID header, and apply any extra headers.
 *
 * @param requestId - Request identifier to attach via the request ID header
 * @param body - Value to serialize as JSON in the response body
 * @param status - HTTP status code for the response
 * @param extraHeaders - Optional additional headers to set on the response
 * @returns A NextResponse containing the JSON-serialized `body`, the given `status`, any `extraHeaders`, and the attached request ID header
 */
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

/**
 * Creates an HTTP redirect response to the specified URL and attaches the request ID header.
 *
 * @param requestId - Request identifier to include in the response headers
 * @param url - Destination URL for the redirect
 * @param status - HTTP status code for the redirect (defaults to 303)
 * @returns A NextResponse that redirects to `url` with the request ID header attached
 */
function redirectWithRequestId(requestId: string, url: URL, status = 303) {
  return attachRequestIdHeader(NextResponse.redirect(url, { status }), requestId);
}

/**
 * Builds a /login URL (relative to the incoming request) and attaches an error query parameter.
 *
 * @param request - The incoming request used to derive the base origin and path
 * @param errorCode - The value to set for the `error` query parameter
 * @returns A `URL` object pointing to `/login` with the `error` query parameter set to `errorCode`
 */
function getLoginErrorUrl(request: NextRequest, errorCode: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", errorCode);
  return url;
}

/**
 * Selects the role-appropriate post-login destination URL.
 *
 * @param request - The incoming request used as the base for the returned URL.
 * @param role - The user's role; when equal to `"CUSTOMER"` the destination is `/measurements/upload`, otherwise `/dashboard`.
 * @returns A URL pointing to the chosen post-login path relative to `request.url`.
 */
function getPostLoginUrl(request: NextRequest, role: string) {
  return new URL(
    role === "CUSTOMER" ? "/measurements/upload" : "/dashboard",
    request.url
  );
}

/**
 * Determines whether the incoming request contains form data (URL-encoded or multipart).
 *
 * @param request - The NextRequest whose Content-Type header will be inspected
 * @returns `true` if the request's Content-Type includes `application/x-www-form-urlencoded` or `multipart/form-data`, `false` otherwise
 */
function isFormSubmission(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  return (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  );
}

/**
 * Parses a login request and extracts the credential and password.
 *
 * When the request is a form submission, reads form fields; otherwise parses JSON body.
 *
 * @returns An object with `credential` (the credential string trimmed, or `""` if missing/invalid) and `password` (the password string, or `""` if missing/invalid)
 */
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

/**
 * Handle POST /login requests: authenticate credentials, create a session, and respond or redirect.
 *
 * Processes form or JSON submissions to authenticate a user within a resolved tenant, enforces rate
 * limits, records or clears login failures, and creates a session on success. For form submissions
 * the function returns redirects to appropriate pages with an attached request ID header; for
 * non-form (JSON) submissions it returns JSON success or error responses with the request ID header.
 *
 * @param request - The incoming NextRequest containing either form data or a JSON body with `credential` and `password`, and request headers used to resolve tenant and client IP.
 * @returns A NextResponse: on success either a redirect (form) or a JSON object with the authenticated `user`; on failure either a redirect (form) or a JSON error object. Responses include a request ID header and may include status-specific headers (e.g., `Retry-After`).
 */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const clientIp = getClientIp(request);
  const formSubmission = isFormSubmission(request);

  try {
    const { credential, password } = await readLoginRequestBody(request);
    const tenantResolution = resolveReadTenant(request);
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
        tenantId,
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

    if (formSubmission) {
      return redirectWithRequestId(requestId, getPostLoginUrl(request, user.role));
    }

    return jsonWithRequestId(requestId, {
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
