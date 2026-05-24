import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getJwtSecret } from "@/lib/jwt-secret";
import { attachRequestIdHeader, logError } from "@/lib/observability";
import { TENANT_HEADER } from "@/lib/tenant";
import { SESSION_COOKIE_NAME } from "@/lib/cookie";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/register",
  "/api/auth/register",
  "/reset-password",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/preferences/language",
  "/api/health",
  "/api/bills/*/public",
  "/guides",
  "/api/jobs/process-import",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((pattern) => {
    if (pattern.includes("*")) {
      const regex = new RegExp(`^${pattern.replace(/\*/g, "[^/]+")}$`);
      return regex.test(pathname);
    }

    return pathname.startsWith(pattern);
  });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId =
    request.headers.get("x-request-id")?.trim() || crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  
  // Strip any client-supplied tenant header immediately — it will be set
  // authoritatively from the verified JWT payload below.
  requestHeaders.delete(TENANT_HEADER);
  
  let jwtSecret: Uint8Array;

  function nextWithRequestHeaders() {
    return attachRequestIdHeader(
      NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      }),
      requestId
    );
  }

  function redirectWithRequestId(url: URL) {
    return attachRequestIdHeader(NextResponse.redirect(url), requestId);
  }

  try {
    jwtSecret = getJwtSecret();
  } catch (error) {
    logError("proxy.auth.misconfigured", {
      requestId,
      pathname,
      error,
    });
    return attachRequestIdHeader(
      NextResponse.json(
        { error: "Server auth is misconfigured" },
        { status: 500 }
      ),
      requestId
    );
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const isAuthPage = pathname === "/login" || pathname === "/register";

  if (isAuthPage && token) {
    try {
      const { payload } = await jwtVerify(token, jwtSecret);
      const role = payload.role as string;
      const redirectPath =
        role === "SUPERADMIN"
          ? "/admin/stats"
          : role === "CUSTOMER"
            ? "/measurements/upload"
            : "/dashboard";
      return redirectWithRequestId(new URL(redirectPath, request.url));
    } catch {
      // Invalid token, remove it and let them see the login page
      const response = nextWithRequestHeaders();
      response.cookies.delete(SESSION_COOKIE_NAME);
      return response;
    }
  }

  if (
    isPublicPath(pathname) ||
    pathname === "/" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return nextWithRequestHeaders();
  }

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    return redirectWithRequestId(loginUrl);
  }

  try {
    const { payload } = await jwtVerify(token, jwtSecret);

    requestHeaders.set("x-user-id", payload.userId as string);
    requestHeaders.set("x-user-role", payload.role as string);
    requestHeaders.set("x-user-name", payload.name as string);

    // Read-only impersonation: block writes. The exit endpoint must still work,
    // otherwise the operator can't get out of the read-only session.
    if (
      payload.readOnly === true &&
      request.method !== "GET" &&
      request.method !== "HEAD" &&
      !pathname.startsWith("/api/admin/exit-impersonation") &&
      !pathname.startsWith("/api/auth/logout")
    ) {
      return attachRequestIdHeader(
        NextResponse.json(
          { error: "Read-only impersonation: writes are blocked. Exit impersonation first." },
          { status: 403 }
        ),
        requestId
      );
    }
    
    const tenantId =
      (typeof payload.tenantId === "string" && payload.tenantId.trim()
        ? payload.tenantId.trim()
        : null) ?? process.env.DEFAULT_TENANT_ID?.trim() ?? null;
    
    // Always overwrite — header was stripped above so only the server-derived
    // value reaches API routes. If no tenant can be resolved the header stays
    // absent and routes will return a 500 tenant-context-missing error.
    if (tenantId) {
      requestHeaders.set(TENANT_HEADER, tenantId);
    }

    const role = payload.role as string;

    if (role === "CUSTOMER") {
      const allowed = [
        "/measurements/upload",
        "/measurements/my-uploads",
        "/api/measurements",
        "/api/assets",
        "/api/upload",
        "/api/auth",
      ];
      if (!allowed.some((p) => pathname.startsWith(p))) {
        const redirectUrl = new URL("/measurements/upload", request.url);
        return redirectWithRequestId(redirectUrl);
      }
    }

    if (
      (pathname.startsWith("/admin") || pathname.startsWith("/api/admin/stats")) &&
      role !== "SUPERADMIN"
    ) {
      if (pathname.startsWith("/api/")) {
        return attachRequestIdHeader(
          NextResponse.json({ error: "Forbidden" }, { status: 403 }),
          requestId
        );
      }
      const redirectUrl = new URL("/dashboard", request.url);
      return redirectWithRequestId(redirectUrl);
    }

    if (
      role === "SUPERADMIN" &&
      !pathname.startsWith("/admin") &&
      !pathname.startsWith("/api/admin") &&
      !pathname.startsWith("/api/auth")
    ) {
      const redirectUrl = new URL("/admin/stats", request.url);
      return redirectWithRequestId(redirectUrl);
    }

    if (pathname.startsWith("/settings") && role !== "ADMIN") {
      const redirectUrl = new URL("/dashboard", request.url);
      return redirectWithRequestId(redirectUrl);
    }

    if (
      pathname.startsWith("/reports") &&
      role !== "ADMIN" &&
      role !== "ACCOUNTANT"
    ) {
      const redirectUrl = new URL("/dashboard", request.url);
      return redirectWithRequestId(redirectUrl);
    }

    return nextWithRequestHeaders();
  } catch {
    const loginUrl = new URL("/login", request.url);
    const response = redirectWithRequestId(loginUrl);
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
