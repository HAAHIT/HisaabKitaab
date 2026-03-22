import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getJwtSecret } from "@/lib/jwt-secret";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let jwtSecret: Uint8Array;

  try {
    jwtSecret = getJwtSecret();
  } catch (error) {
    console.error("Middleware auth configuration error:", error);
    return NextResponse.json({ error: "Server auth is misconfigured" }, { status: 500 });
  }

  // Allow public paths and static assets
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("doorcraft-session")?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const { payload } = await jwtVerify(token, jwtSecret);
    
    // Pass user info into request headers so API routes can read them
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", payload.userId as string);
    requestHeaders.set("x-user-role", payload.role as string);
    requestHeaders.set("x-user-name", payload.name as string);

    // Role-based route protection
    const role = payload.role as string;

    // Customer can only access measurements
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
        return NextResponse.redirect(redirectUrl);
      }
    }

    // Admin-only routes
    if (pathname.startsWith("/settings") && role !== "ADMIN") {
      const redirectUrl = new URL("/dashboard", request.url);
      return NextResponse.redirect(redirectUrl);
    }

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch {
    // Invalid token — clear it and redirect to login
    const loginUrl = new URL("/login", request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete("doorcraft-session");
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
