import { prisma } from "@/lib/prisma";

export interface BillSeries {
  id: string;
  name: string;
  prefix: string;
  isDefault: boolean;
}

interface SettingsShape {
  billPrefix?: string;
  billSeries?: BillSeries[];
}

function readSettings(value: unknown): SettingsShape {
  if (!value || typeof value !== "object") return {};
  return value as SettingsShape;
}

const PREFIX_RE = /^[A-Z0-9_\-/]{1,12}$/;

export function isValidPrefix(prefix: string): boolean {
  return PREFIX_RE.test(prefix);
}

/**
 * Return the configured bill series for a tenant. If none are configured,
 * synthesise a single "Default" series from the legacy single billPrefix field
 * so callers can always treat the result as non-empty.
 */
export function normalizeBillSeries(value: unknown): BillSeries[] {
  const settings = readSettings(value);
  const list = Array.isArray(settings.billSeries) ? settings.billSeries : [];
  const valid = list
    .filter((s): s is BillSeries => Boolean(s) && typeof s === "object")
    .map((s) => ({
      id: String(s.id ?? ""),
      name: String(s.name ?? "").trim() || "Untitled",
      prefix: String(s.prefix ?? "").trim().toUpperCase(),
      isDefault: Boolean(s.isDefault),
    }))
    .filter((s) => s.id && isValidPrefix(s.prefix));

  if (valid.length > 0) {
    const hasDefault = valid.some((s) => s.isDefault);
    if (!hasDefault) valid[0].isDefault = true;
    return valid;
  }

  // Backfill from legacy single billPrefix.
  const legacyPrefix =
    typeof settings.billPrefix === "string" && settings.billPrefix.trim()
      ? settings.billPrefix.trim().toUpperCase()
      : "BILL";
  return [
    {
      id: "default",
      name: "Default",
      prefix: legacyPrefix,
      isDefault: true,
    },
  ];
}

export async function listBillSeries(tenantId: string): Promise<BillSeries[]> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  return normalizeBillSeries(tenant?.settings);
}

export async function resolveBillSeriesPrefix(
  tenantId: string,
  billSeriesId?: string | null
): Promise<{ id: string; prefix: string }> {
  const series = await listBillSeries(tenantId);
  if (billSeriesId) {
    const found = series.find((s) => s.id === billSeriesId);
    if (found) return { id: found.id, prefix: found.prefix };
  }
  const def = series.find((s) => s.isDefault) ?? series[0];
  return { id: def.id, prefix: def.prefix };
}

export async function writeBillSeries(
  tenantId: string,
  next: BillSeries[]
): Promise<BillSeries[]> {
  const normalized = next
    .map((s) => ({
      id: String(s.id || "").trim() || crypto.randomUUID(),
      name: String(s.name || "").trim() || "Untitled",
      prefix: String(s.prefix || "").trim().toUpperCase(),
      isDefault: Boolean(s.isDefault),
    }))
    .filter((s) => isValidPrefix(s.prefix));

  if (normalized.length === 0) {
    throw new Error("At least one bill series is required.");
  }

  const prefixSet = new Set<string>();
  for (const s of normalized) {
    if (prefixSet.has(s.prefix)) {
      throw new Error(`Duplicate prefix: ${s.prefix}`);
    }
    prefixSet.add(s.prefix);
  }

  const hasDefault = normalized.some((s) => s.isDefault);
  if (!hasDefault) normalized[0].isDefault = true;
  let seenDefault = false;
  for (const s of normalized) {
    if (s.isDefault) {
      if (seenDefault) s.isDefault = false;
      seenDefault = true;
    }
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  const currentSettings = (tenant?.settings as Record<string, unknown> | null) ?? {};
  const newSettings = { ...currentSettings, billSeries: normalized };
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: newSettings as object },
  });
  return normalized;
}
