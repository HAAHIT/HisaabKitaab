import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { TENANT_CONTEXT_MISSING_MESSAGE, resolveTenantIdFromRequest } from "@/lib/tenant";
import { resolveVerifiedTenantId, resolveVerifiedSession } from "@/lib/session-server";
import type { VerifiedSession } from "@/lib/session-server";

type TenantResolution =
  | {
    ok: true;
    tenantId: string;
  }
  | {
    ok: false;
    response: NextResponse<{ error: string }>;
  };

// [FIX #5] Full session resolution — returns tenantId, userId, role from JWT
type SessionResolution =
  | {
    ok: true;
    session: VerifiedSession;
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

/**
 * [FIX #5] Resolves the full JWT-verified session for write operations.
 *
 * Replaces the pattern of reading x-user-role/x-user-id from headers,
 * which can be spoofed if the proxy is bypassed.
 */
export async function resolveWriteSession(
  request: NextRequest
): Promise<SessionResolution> {
  const session = await resolveVerifiedSession(request);
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      ),
    };
  }

  return {
    ok: true,
    session,
  };
}

/**
 * [FIX #18] Resolves tenant for public/unauthenticated operations where a JWT is not available.
 * Uses ESM import instead of require() for tree-shaking compatibility.
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
