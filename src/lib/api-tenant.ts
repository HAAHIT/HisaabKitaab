import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { TENANT_CONTEXT_MISSING_MESSAGE, resolveTenantIdFromRequest } from "@/lib/tenant";
import { resolveVerifiedTenantId } from "@/lib/session-server";
import { verifyToken, type SessionPayload } from "@/lib/auth";

type TenantResolution =
  | {
      ok: true;
      tenantId: string;
    }
  | {
      ok: false;
      response: NextResponse<{ error: string }>;
    };

function tenantMissingResponse() {
  return NextResponse.json(
    { error: TENANT_CONTEXT_MISSING_MESSAGE },
    { status: 500 }
  );
}

/**
 * [LB-1] Resolves tenant for READ operations by verifying the JWT cookie.
 *
 * Previously this function trusted the proxy-set x-tenant-id header,
 * creating a defence-in-depth gap where proxy bypass could leak data.
 * Now uses the same JWT verification as write operations.
 */
export async function resolveReadTenant(
  request: NextRequest
): Promise<TenantResolution> {
  const tenantId = await resolveVerifiedTenantId(request);
  if (!tenantId) {
    return {
      ok: false,
      response: tenantMissingResponse(),
    };
  }

  return {
    ok: true,
    tenantId,
  };
}

export async function resolveWriteTenant(
  request: NextRequest
): Promise<TenantResolution> {
  const tenantId = await resolveVerifiedTenantId(request);
  if (!tenantId) {
    return {
      ok: false,
      response: tenantMissingResponse(),
    };
  }

  return {
    ok: true,
    tenantId,
  };
}

type SessionResolution =
  | { ok: true; session: SessionPayload }
  | { ok: false; response: NextResponse<{ error: string }> };

const COOKIE_NAME = "hisaabkitaab-session";

/**
 * Verifies the JWT cookie and returns the full session (tenantId, userId, role).
 * Use this for any route that needs role or userId alongside tenantId.
 * Never trust x-user-role / x-user-id proxy headers for auth decisions.
 */
export async function resolveSession(
  request: NextRequest
): Promise<SessionResolution> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const session = await verifyToken(token);
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true, session };
}

/**
 * Resolves tenant for public/unauthenticated operations where a JWT is not available.
 * Relies on the x-tenant-id header (set by proxy) or default environment variables.
 */
export function resolvePublicTenant(
  request: NextRequest
): TenantResolution {
  const tenantId = resolveTenantIdFromRequest(request);
  
  if (!tenantId) {
    return {
      ok: false,
      response: tenantMissingResponse(),
    };
  }

  return {
    ok: true,
    tenantId,
  };
}
