import crypto from "crypto";

/**
 * Tenant-scoped PostgreSQL advisory lock key generator.
 *
 * All balance-mutating routes (bills, purchases, credit-notes, payments)
 * intentionally share a single lock per tenant so that cross-resource race
 * conditions (e.g. a payment landing between a bill insert and its party
 * balance update) cannot interleave. Callers that operate on state genuinely
 * independent of party balances may pass a distinct `resource` string.
 *
 * Returns a 60-bit BigInt that fits comfortably inside PostgreSQL's 64-bit
 * advisory lock space. The no-arg call preserves the historical hash so
 * in-flight requests during a deploy continue to serialise correctly.
 */
export function generateLockKey(tenantId: string, resource?: string): bigint {
  const input = resource ? `${tenantId}:${resource}` : tenantId;
  const hash = crypto.createHash("sha256").update(input).digest("hex");
  return BigInt("0x" + hash.substring(0, 15));
}
