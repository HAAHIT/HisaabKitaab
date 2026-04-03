export const TENANT_HEADER = "x-tenant-id";
export const TENANT_CONTEXT_MISSING_MESSAGE =
  "Tenant context missing. Ensure DEFAULT_TENANT_ID is set or the session contains a tenantId.";

type RequestLike = {
  headers: Headers;
};

function normalizeTenantId(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

export function resolveTenantIdFromRequest(
  request: RequestLike | null | undefined
) {
  const fromHeader = normalizeTenantId(request?.headers.get(TENANT_HEADER));
  if (fromHeader) {
    return fromHeader;
  }

  return normalizeTenantId(process.env.DEFAULT_TENANT_ID);
}
