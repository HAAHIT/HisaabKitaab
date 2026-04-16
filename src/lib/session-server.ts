import { jwtVerify } from "jose";
import { getJwtSecret } from "@/lib/jwt-secret";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "hisaabkitaab-session";

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
  const token = request.cookies.get(COOKIE_NAME)?.value;

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
