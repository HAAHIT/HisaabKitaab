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

function tenantMissingResponse() {
  return NextResponse.json(
    { error: TENANT_CONTEXT_MISSING_MESSAGE },
    { status: 500 }
  );
}

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
