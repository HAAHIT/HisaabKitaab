import { jwtVerify } from "jose";
import { getJwtSecret } from "@/lib/jwt-secret";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "hisaabkitaab-session";

/**
 * Obtains the tenant ID from the verified session JWT cookie.
 *
 * Falls back to the trimmed `DEFAULT_TENANT_ID` environment value when the cookie is missing or does not contain a valid tenant ID; JWT verification errors are ignored.
 *
 * @returns The tenant ID extracted from the verified session JWT if present and valid, otherwise the trimmed `DEFAULT_TENANT_ID` value or `null`.
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
