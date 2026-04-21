import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { TENANT_CONTEXT_MISSING_MESSAGE } from "@/lib/tenant";
import { resolveVerifiedTenantId } from "@/lib/session-server";

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

/**
 * Resolves tenant for public/unauthenticated operations where a JWT is not available.
 * Relies on the x-tenant-id header (set by proxy) or default environment variables.
 */
export function resolvePublicTenant(
  request: NextRequest
): TenantResolution {
  const { resolveTenantIdFromRequest } = require("@/lib/tenant");
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
