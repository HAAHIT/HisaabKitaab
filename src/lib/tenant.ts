import { headers } from "next/headers";

const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || "";

/**
 * Reads tenantId from request headers (set by middleware).
 * Falls back to DEFAULT_TENANT_ID during the single-tenant phase.
 *
 * Use in API routes: const tenantId = await getTenantId();
 */
export async function getTenantId(): Promise<string> {
  const headerList = await headers();
  return headerList.get("x-tenant-id") || DEFAULT_TENANT_ID;
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
