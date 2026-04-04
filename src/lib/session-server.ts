import { jwtVerify } from "jose";
import { getJwtSecret } from "@/lib/jwt-secret";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "hisaabkitaab-session";

/**
 * Resolves the tenant ID by verifying the JWT cookie directly.
 *
 * Use this in write paths (POST/PUT/DELETE) instead of resolveTenantIdFromRequest
 * so that the tenantId used in raw SQL is always sourced from a cryptographically
 * verified token — not from a request header that could be injected if middleware
 * is misconfigured or bypassed.
 */
export async function resolveVerifiedTenantId(
  request: NextRequest
): Promise<string | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, getJwtSecret());
      const tenantId =
        typeof payload.tenantId === "string" && payload.tenantId.trim()
          ? payload.tenantId.trim()
          : null;
      if (tenantId) return tenantId;
    } catch {
      // Token invalid or expired — fall through to env fallback.
    }
  }

  // Single-tenant deployments that rely solely on DEFAULT_TENANT_ID
  // (no tenantId embedded in JWT) are still supported.
  return process.env.DEFAULT_TENANT_ID?.trim() ?? null;
}
