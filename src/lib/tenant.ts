import { headers } from "next/headers";

export const TENANT_HEADER = "x-tenant-id";
export const TENANT_CONTEXT_MISSING_MESSAGE =
  "Tenant context missing. Ensure DEFAULT_TENANT_ID is set or the session contains a tenantId.";

const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || "";
type TenantHeaderSource = Headers | { headers: Headers };

/**
 * Normalize a tenant identifier by trimming surrounding whitespace and treating empty or missing values as `null`.
 *
 * @param value - The tenant identifier to normalize; may be `string`, `null`, or `undefined`
 * @returns The trimmed tenant identifier, or `null` if `value` is falsy or contains only whitespace
 */
function normalizeTenantId(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

/**
 * Resolves a tenant id from a request-like object’s headers or falls back to the configured default.
 *
 * @param request - An object with a `headers: Headers` property, or `null`/`undefined`; the `x-tenant-id` header is read when present.
 * @returns The resolved tenant id string; if the header is missing or empty, returns the configured default tenant id.
 */
export function resolveTenantIdFromRequest(
  request: { headers: Headers } | null | undefined
) {
  const fromHeader = normalizeTenantId(request?.headers.get(TENANT_HEADER));
  if (fromHeader) {
    return fromHeader;
  }
  return normalizeTenantId(process.env.DEFAULT_TENANT_ID) || DEFAULT_TENANT_ID;
}

/**
 * Selects the tenant identifier from the provided headers, falling back to the default tenant id.
 *
 * @param headerSource - Optional Headers object to read the `x-tenant-id` header from
 * @returns The trimmed `x-tenant-id` value if present and non-empty, otherwise `DEFAULT_TENANT_ID`
 */
function resolveTenantId(headerSource?: Headers | null) {
  const tenantId = headerSource?.get(TENANT_HEADER)?.trim();
  return tenantId || DEFAULT_TENANT_ID;
}

/**
 * Resolve the active tenant ID from an explicit header source or from the current request headers, falling back to the default tenant.
 *
 * @param source - Optional `Headers` or an object with a `headers: Headers` property to read the `x-tenant-id` header from. If omitted, the function attempts to read Next.js request headers.
 * @returns The tenant ID string from the `x-tenant-id` header if present and non-empty, otherwise `DEFAULT_TENANT_ID`.
 */
export async function getTenantId(
  source?: TenantHeaderSource | null
): Promise<string> {
  if (source) {
    return resolveTenantId(
      source instanceof Headers ? source : source.headers
    );
  }

  try {
    const headerList = await headers();
    return resolveTenantId(headerList);
  } catch {
    return DEFAULT_TENANT_ID;
  }
}

/**
 * Provide a Prisma `where` clause fragment that scopes queries to the current tenant.
 *
 * @returns An object with `tenantId` set to the resolved tenant identifier
 */
export async function tenantScope() {
  return { tenantId: await getTenantId() };
}

/**
 * Provide record data containing the current tenant's identifier for inclusion in create/update payloads.
 *
 * @returns An object with `tenantId` set to the resolved tenant identifier
 */
export async function tenantData() {
  return { tenantId: await getTenantId() };
}
