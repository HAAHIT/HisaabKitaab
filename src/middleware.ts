import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getJwtSecret } from "@/lib/jwt-secret";
import { attachRequestIdHeader, logError } from "@/lib/observability";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/health"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = request.headers.get("x-request-id")?.trim() || crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
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
    logError("middleware.auth.misconfigured", {
      requestId,
      pathname,
      error,
    });
    return attachRequestIdHeader(
      NextResponse.json({ error: "Server auth is misconfigured" }, { status: 500 }),
      requestId
    );
  }

  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return nextWithRequestHeaders();
  }

  const token = request.cookies.get("doorcraft-session")?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    return redirectWithRequestId(loginUrl);
  }

  try {
    const { payload } = await jwtVerify(token, jwtSecret);

    requestHeaders.set("x-user-id", payload.userId as string);
    requestHeaders.set("x-user-role", payload.role as string);
    requestHeaders.set("x-user-name", payload.name as string);

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

    if (pathname.startsWith("/settings") && role !== "ADMIN") {
      const redirectUrl = new URL("/dashboard", request.url);
      return redirectWithRequestId(redirectUrl);
    }

    return nextWithRequestHeaders();
  } catch {
    const loginUrl = new URL("/login", request.url);
    const response = redirectWithRequestId(loginUrl);
    response.cookies.delete("doorcraft-session");
    return response;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
