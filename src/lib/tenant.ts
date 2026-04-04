import { headers } from "next/headers";

export const TENANT_HEADER = "x-tenant-id";
export const TENANT_CONTEXT_MISSING_MESSAGE =
  "Tenant context missing. Ensure DEFAULT_TENANT_ID is set or the session contains a tenantId.";

const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || "";
type TenantHeaderSource = Headers | { headers: Headers };

function normalizeTenantId(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

export function resolveTenantIdFromRequest(
  request: { headers: Headers } | null | undefined
) {
  const fromHeader = normalizeTenantId(request?.headers.get(TENANT_HEADER));
  if (fromHeader) {
    return fromHeader;
  }
  return normalizeTenantId(process.env.DEFAULT_TENANT_ID) || DEFAULT_TENANT_ID;
}

function resolveTenantId(headerSource?: Headers | null) {
  const tenantId = headerSource?.get(TENANT_HEADER)?.trim();
  return tenantId || DEFAULT_TENANT_ID;
}

/**
 * Reads tenantId from request headers (set by middleware).
 * Falls back to DEFAULT_TENANT_ID during the single-tenant phase.
 *
 * Use in API routes: const tenantId = await getTenantId();
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
 * Returns a Prisma `where` clause fragment for tenant scoping.
 * Usage: prisma.bill.findMany({ where: { ...await tenantScope(), status: "FINAL" } })
 */
export async function tenantScope() {
  return { tenantId: await getTenantId() };
}

/**
 * Returns data fields for creating records with tenant context.
 * Usage: prisma.bill.create({ data: { ...await tenantData(), billNumber: "..." } })
 */
export async function tenantData() {
  return { tenantId: await getTenantId() };
}
