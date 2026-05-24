import { jwtVerify } from "jose";
import { getJwtSecret } from "@/lib/jwt-secret";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/cookie";
import { prisma } from "@/lib/prisma";

export interface VerifiedSession {
  tenantId: string;
  userId: string;
  role: string;
  name: string;
}

/**
 * Resolves the tenant ID by verifying the JWT cookie directly.
 *
 * RULE: Use for ALL write operations (POST / PATCH / PUT / DELETE).
 * Use resolveTenantIdFromRequest (header-based) only for read-only GETs.
 *
 * Rationale: the proxy sets x-tenant-id from the JWT, but re-verifying here
 * ensures write paths cannot be spoofed by a misconfigured or bypassed middleware.
 */
export async function resolveVerifiedTenantId(
  request: NextRequest
): Promise<string | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  // No token at all — caller is unauthenticated. Never fall back to the env
  // variable here: doing so would let any client forge x-user-role/x-user-id
  // headers and write to the default tenant without a session.
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const tenantId =
      typeof payload.tenantId === "string" && payload.tenantId.trim()
        ? payload.tenantId.trim()
        : null;
    // Token is valid but has no tenantId claim — single-tenant JWT. Fall back
    // to the env variable only in this case (token was genuinely verified).
    return tenantId ?? process.env.DEFAULT_TENANT_ID?.trim() ?? null;
  } catch {
    // Token is present but invalid or expired — reject, do not fall back.
    return null;
  }
}

export async function resolveVerifiedSession(
  request: NextRequest
): Promise<VerifiedSession | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const tenantId =
      typeof payload.tenantId === "string" && payload.tenantId.trim()
        ? payload.tenantId.trim()
        : process.env.DEFAULT_TENANT_ID?.trim() ?? null;
    const userId =
      typeof payload.userId === "string" && payload.userId.trim()
        ? payload.userId.trim()
        : null;
    const role =
      typeof payload.role === "string" && payload.role.trim()
        ? payload.role.trim()
        : null;
    const name =
      typeof payload.name === "string" ? payload.name.trim() : "";

    if (!tenantId || !userId || !role) return null;
    return { tenantId, userId, role, name };
  } catch {
    return null;
  }
}

/**
 * Resolves the full verified session from the JWT cookie for Server Components.
 * Server Components cannot access NextRequest — they use next/headers cookies().
 */
export interface SuperAdminSession {
  userId: string;
  email: string;
  name: string;
}

/**
 * Resolves a verified SUPERADMIN session. The signed JWT alone isn't trusted —
 * we re-check the user's role and active status against the DB on every call,
 * so revoking a superadmin (setting role/isActive in DB) takes effect immediately.
 * This is the only function in the codebase that intentionally bypasses tenant
 * scoping — callers run cross-tenant queries.
 */
export async function resolveSuperAdminSession(
  request: NextRequest
): Promise<SuperAdminSession | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const role = typeof payload.role === "string" ? payload.role.trim() : null;
    const userId = typeof payload.userId === "string" ? payload.userId.trim() : null;
    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    if (role !== "SUPERADMIN" || !userId) return null;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, role: true, isActive: true },
    });
    if (!user || !user.isActive || user.role !== "SUPERADMIN") return null;
    return { userId, email: user.email ?? "", name };
  } catch {
    return null;
  }
}

export async function resolveServerSession(): Promise<VerifiedSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const tenantId =
      typeof payload.tenantId === "string" && payload.tenantId.trim()
        ? payload.tenantId.trim()
        : process.env.DEFAULT_TENANT_ID?.trim() ?? null;
    const userId =
      typeof payload.userId === "string" && payload.userId.trim()
        ? payload.userId.trim()
        : null;
    const role =
      typeof payload.role === "string" && payload.role.trim()
        ? payload.role.trim()
        : null;
    const name =
      typeof payload.name === "string" ? payload.name.trim() : "";

    if (!tenantId || !userId || !role) return null;
    return { tenantId, userId, role, name };
  } catch {
    return null;
  }
}
