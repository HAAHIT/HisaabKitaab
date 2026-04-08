import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  resolveTenantIdFromRequest,
  TENANT_CONTEXT_MISSING_MESSAGE,
} from "@/lib/tenant";
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

/**
 * Create a JSON response signaling that tenant context is missing.
 *
 * @returns A NextResponse with body `{ error: TENANT_CONTEXT_MISSING_MESSAGE }` and HTTP status 500.
 */
function tenantMissingResponse() {
  return NextResponse.json(
    { error: TENANT_CONTEXT_MISSING_MESSAGE },
    { status: 500 }
  );
}

/**
 * Resolve the tenant identifier for a read (non-mutating) API request or produce a standardized error response when tenant context is missing.
 *
 * @param request - The incoming Next.js request from which to extract the tenant context
 * @returns `{ ok: true, tenantId: string }` when a tenant ID is found; otherwise `{ ok: false, response: NextResponse<{ error: string }> }` where `response` is a 500 JSON error indicating the tenant context is missing
 */
export function resolveReadTenant(request: NextRequest): TenantResolution {
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

/**
 * Resolve and verify the tenant ID for requests that require write access.
 *
 * If a verified tenant ID cannot be derived, returns a `NextResponse` containing
 * the standardized tenant-missing error payload and HTTP status 500.
 *
 * @param request - The incoming request used to derive and verify the tenant context
 * @returns `{ ok: true, tenantId: string }` when a verified tenant ID is found; `{ ok: false, response: NextResponse<{ error: string }> }` otherwise
 */
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
