import { prisma } from "@/lib/prisma";

// Helpers — IST-anchored day buckets. Reuses the convention in journal-reporting.ts
// without coupling to it, since admin stats are cross-tenant and don't need
// the FY-aware helpers from that module.

function daysAgoUtc(n: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

function monthBucketsUtc(count: number): { start: Date; end: Date; label: string }[] {
  const now = new Date();
  const buckets: { start: Date; end: Date; label: string }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1));
    buckets.push({
      start,
      end,
      label: start.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
    });
  }
  return buckets;
}

export interface PlatformOverview {
  tenants: {
    total: number;
    free: number;
    pro: number;
    newLast7d: number;
    newLast30d: number;
    onboardingComplete: number;
  };
  users: {
    total: number;
    active: number;
    byRole: { role: string; count: number }[];
  };
  activity: {
    activeTenants7d: number;
    activeTenants30d: number;
    billsLast30d: number;
    paymentsLast30d: number;
    paymentVolumeLast30d: number;
    journalEntriesLast30d: number;
    unbalancedJournalEntries: number;
  };
  totals: {
    bills: number;
    payments: number;
    parties: number;
    journalEntries: number;
    auditLogs: number;
    bankAccounts: number;
    itemCatalog: number;
  };
  signupTrend: { label: string; count: number }[];
  volumeTrend: { label: string; bills: number; payments: number; paymentVolume: number }[];
}

export async function getPlatformOverview(): Promise<PlatformOverview> {
  const d7 = daysAgoUtc(7);
  const d30 = daysAgoUtc(30);

  const [
    totalTenants,
    freeTenants,
    proTenants,
    newTenants7d,
    newTenants30d,
    onboardedTenants,
    totalUsers,
    activeUsers,
    usersByRole,
    activeTenantIds7d,
    activeTenantIds30d,
    billsLast30d,
    paymentsLast30dAgg,
    journalEntriesLast30d,
    unbalancedJournalEntries,
    totalBills,
    totalPayments,
    totalParties,
    totalJournalEntries,
    totalAuditLogs,
    totalBankAccounts,
    totalItemCatalog,
  ] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { plan: "FREE" } }),
    prisma.tenant.count({ where: { plan: "PRO" } }),
    prisma.tenant.count({ where: { createdAt: { gte: d7 } } }),
    prisma.tenant.count({ where: { createdAt: { gte: d30 } } }),
    prisma.tenant.count({ where: { isOnboardingComplete: true } }),
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.bill.findMany({
      where: { createdAt: { gte: d7 }, isDeleted: false },
      distinct: ["tenantId"],
      select: { tenantId: true },
    }),
    prisma.bill.findMany({
      where: { createdAt: { gte: d30 }, isDeleted: false },
      distinct: ["tenantId"],
      select: { tenantId: true },
    }),
    prisma.bill.count({ where: { createdAt: { gte: d30 }, isDeleted: false } }),
    prisma.payment.aggregate({
      where: { createdAt: { gte: d30 }, isDeleted: false, status: "COMPLETED" },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.journalEntry.count({ where: { createdAt: { gte: d30 }, isDeleted: false } }),
    prisma.journalEntry.count({ where: { isBalanced: false, isDeleted: false } }),
    prisma.bill.count({ where: { isDeleted: false } }),
    prisma.payment.count({ where: { isDeleted: false } }),
    prisma.party.count({ where: { isDeleted: false } }),
    prisma.journalEntry.count({ where: { isDeleted: false } }),
    prisma.auditLog.count(),
    prisma.bankAccount.count({ where: { isDeleted: false } }),
    prisma.itemCatalog.count({ where: { isActive: true } }),
  ]);

  const months = monthBucketsUtc(6);
  const signupTrend: { label: string; count: number }[] = [];
  const volumeTrend: { label: string; bills: number; payments: number; paymentVolume: number }[] = [];

  for (const m of months) {
    const [signups, bills, payAgg] = await Promise.all([
      prisma.tenant.count({ where: { createdAt: { gte: m.start, lt: m.end } } }),
      prisma.bill.count({ where: { createdAt: { gte: m.start, lt: m.end }, isDeleted: false } }),
      prisma.payment.aggregate({
        where: { createdAt: { gte: m.start, lt: m.end }, isDeleted: false, status: "COMPLETED" },
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);
    signupTrend.push({ label: m.label, count: signups });
    volumeTrend.push({
      label: m.label,
      bills,
      payments: payAgg._count._all,
      paymentVolume: payAgg._sum.amount?.toNumber() ?? 0,
    });
  }

  return {
    tenants: {
      total: totalTenants,
      free: freeTenants,
      pro: proTenants,
      newLast7d: newTenants7d,
      newLast30d: newTenants30d,
      onboardingComplete: onboardedTenants,
    },
    users: {
      total: totalUsers,
      active: activeUsers,
      byRole: usersByRole.map((r) => ({ role: r.role, count: r._count._all })),
    },
    activity: {
      activeTenants7d: activeTenantIds7d.length,
      activeTenants30d: activeTenantIds30d.length,
      billsLast30d,
      paymentsLast30d: paymentsLast30dAgg._count._all,
      paymentVolumeLast30d: paymentsLast30dAgg._sum.amount?.toNumber() ?? 0,
      journalEntriesLast30d,
      unbalancedJournalEntries,
    },
    totals: {
      bills: totalBills,
      payments: totalPayments,
      parties: totalParties,
      journalEntries: totalJournalEntries,
      auditLogs: totalAuditLogs,
      bankAccounts: totalBankAccounts,
      itemCatalog: totalItemCatalog,
    },
    signupTrend,
    volumeTrend,
  };
}

export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  createdAt: string;
  isOnboardingComplete: boolean;
  userCount: number;
  billCount: number;
  paymentCount: number;
  partyCount: number;
  paymentVolume: number;
  lastActivityAt: string | null;
  unbalancedEntries: number;
}

export async function listTenantStats(opts: {
  limit?: number;
  offset?: number;
  search?: string;
}): Promise<{ rows: TenantRow[]; total: number }> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const where = opts.search
    ? {
        OR: [
          { name: { contains: opts.search, mode: "insensitive" as const } },
          { slug: { contains: opts.search, mode: "insensitive" as const } },
          { gstin: { contains: opts.search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        createdAt: true,
        isOnboardingComplete: true,
        _count: {
          select: {
            users: true,
            bills: { where: { isDeleted: false } },
            payments: { where: { isDeleted: false } },
            parties: { where: { isDeleted: false } },
            journalEntries: { where: { isDeleted: false, isBalanced: false } },
          },
        },
      },
    }),
    prisma.tenant.count({ where }),
  ]);

  const rows: TenantRow[] = await Promise.all(
    tenants.map(async (t) => {
      const [paymentAgg, lastBill, lastPayment] = await Promise.all([
        prisma.payment.aggregate({
          where: { tenantId: t.id, isDeleted: false, status: "COMPLETED" },
          _sum: { amount: true },
        }),
        prisma.bill.findFirst({
          where: { tenantId: t.id, isDeleted: false },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
        prisma.payment.findFirst({
          where: { tenantId: t.id, isDeleted: false },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
      ]);
      const lastActivity = [lastBill?.createdAt, lastPayment?.createdAt]
        .filter((d): d is Date => !!d)
        .sort((a, b) => b.getTime() - a.getTime())[0];
      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        plan: t.plan,
        createdAt: t.createdAt.toISOString(),
        isOnboardingComplete: t.isOnboardingComplete ?? false,
        userCount: t._count.users,
        billCount: t._count.bills,
        paymentCount: t._count.payments,
        partyCount: t._count.parties,
        paymentVolume: paymentAgg._sum.amount?.toNumber() ?? 0,
        lastActivityAt: lastActivity?.toISOString() ?? null,
        unbalancedEntries: t._count.journalEntries,
      };
    })
  );

  return { rows, total };
}

export interface ActivityRow {
  id: string;
  tenantId: string;
  tenantName: string;
  entityType: string;
  entityId: string;
  action: string;
  actorType: string;
  userId: string | null;
  createdAt: string;
}

export async function listRecentActivity(opts: {
  limit?: number;
  tenantId?: string;
}): Promise<ActivityRow[]> {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  const where = opts.tenantId ? { tenantId: opts.tenantId } : {};
  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { tenant: { select: { name: true } } },
  });
  return logs.map((l) => ({
    id: l.id,
    tenantId: l.tenantId,
    tenantName: l.tenant.name,
    entityType: l.entityType,
    entityId: l.entityId,
    action: l.action,
    actorType: l.actorType,
    userId: l.userId,
    createdAt: l.createdAt.toISOString(),
  }));
}

// ── Tenant detail ─────────────────────────────────────────────────────────────

export interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  plan: string;
  email: string | null;
  phone: string | null;
  gstin: string | null;
  createdAt: string;
  isOnboardingComplete: boolean;
  counts: {
    users: number;
    parties: number;
    bills: number;
    payments: number;
    journalEntries: number;
    bankAccounts: number;
    unbalancedEntries: number;
    auditLogs: number;
  };
  paymentVolume: number;
  last30d: {
    bills: number;
    payments: number;
    paymentVolume: number;
  };
  trend: { label: string; bills: number; payments: number; paymentVolume: number }[];
  users: { id: string; name: string; email: string | null; role: string; isActive: boolean; createdAt: string }[];
  recentBills: { id: string; billNumber: string; customerName: string; grandTotal: number; status: string; createdAt: string }[];
  recentPayments: { id: string; amount: number; direction: string; mode: string; partyName: string | null; createdAt: string }[];
  unbalancedJournals: { id: string; entryDate: string; narration: string; totalDebit: number; totalCredit: number }[];
}

export async function getTenantDetail(tenantId: string): Promise<TenantDetail | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true, name: true, slug: true, plan: true, email: true, phone: true,
      gstin: true, createdAt: true, isOnboardingComplete: true,
    },
  });
  if (!tenant) return null;

  const d30 = daysAgoUtc(30);

  const [
    userCount, partyCount, billCount, paymentCount, journalCount,
    bankCount, unbalancedCount, auditCount,
    paymentVolumeAgg,
    billsLast30d, paymentsLast30dAgg,
    users, recentBills, recentPayments, unbalancedJournals,
  ] = await Promise.all([
    prisma.user.count({ where: { tenantId } }),
    prisma.party.count({ where: { tenantId, isDeleted: false } }),
    prisma.bill.count({ where: { tenantId, isDeleted: false } }),
    prisma.payment.count({ where: { tenantId, isDeleted: false } }),
    prisma.journalEntry.count({ where: { tenantId, isDeleted: false } }),
    prisma.bankAccount.count({ where: { tenantId, isDeleted: false } }),
    prisma.journalEntry.count({ where: { tenantId, isBalanced: false, isDeleted: false } }),
    prisma.auditLog.count({ where: { tenantId } }),
    prisma.payment.aggregate({
      where: { tenantId, isDeleted: false, status: "COMPLETED" },
      _sum: { amount: true },
    }),
    prisma.bill.count({ where: { tenantId, isDeleted: false, createdAt: { gte: d30 } } }),
    prisma.payment.aggregate({
      where: { tenantId, isDeleted: false, status: "COMPLETED", createdAt: { gte: d30 } },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.user.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    }),
    prisma.bill.findMany({
      where: { tenantId, isDeleted: false },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, billNumber: true, customerName: true, grandTotal: true, status: true, createdAt: true },
    }),
    prisma.payment.findMany({
      where: { tenantId, isDeleted: false },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true, amount: true, direction: true, mode: true, createdAt: true,
        party: { select: { name: true } },
      },
    }),
    prisma.journalEntry.findMany({
      where: { tenantId, isBalanced: false, isDeleted: false },
      orderBy: { entryDate: "desc" },
      take: 10,
      select: { id: true, entryDate: true, narration: true, totalDebit: true, totalCredit: true },
    }),
  ]);

  const months = monthBucketsUtc(6);
  const trend: { label: string; bills: number; payments: number; paymentVolume: number }[] = [];
  for (const m of months) {
    const [bills, payAgg] = await Promise.all([
      prisma.bill.count({ where: { tenantId, isDeleted: false, createdAt: { gte: m.start, lt: m.end } } }),
      prisma.payment.aggregate({
        where: { tenantId, isDeleted: false, status: "COMPLETED", createdAt: { gte: m.start, lt: m.end } },
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);
    trend.push({
      label: m.label, bills,
      payments: payAgg._count._all,
      paymentVolume: payAgg._sum.amount?.toNumber() ?? 0,
    });
  }

  return {
    ...tenant,
    createdAt: tenant.createdAt.toISOString(),
    isOnboardingComplete: tenant.isOnboardingComplete ?? false,
    counts: {
      users: userCount, parties: partyCount, bills: billCount, payments: paymentCount,
      journalEntries: journalCount, bankAccounts: bankCount,
      unbalancedEntries: unbalancedCount, auditLogs: auditCount,
    },
    paymentVolume: paymentVolumeAgg._sum.amount?.toNumber() ?? 0,
    last30d: {
      bills: billsLast30d,
      payments: paymentsLast30dAgg._count._all,
      paymentVolume: paymentsLast30dAgg._sum.amount?.toNumber() ?? 0,
    },
    trend,
    users: users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })),
    recentBills: recentBills.map((b) => ({
      ...b, grandTotal: b.grandTotal.toNumber(), createdAt: b.createdAt.toISOString(),
    })),
    recentPayments: recentPayments.map((p) => ({
      id: p.id, amount: p.amount.toNumber(), direction: p.direction, mode: p.mode,
      partyName: p.party?.name ?? null, createdAt: p.createdAt.toISOString(),
    })),
    unbalancedJournals: unbalancedJournals.map((j) => ({
      id: j.id, entryDate: j.entryDate.toISOString(), narration: j.narration,
      totalDebit: j.totalDebit.toNumber(), totalCredit: j.totalCredit.toNumber(),
    })),
  };
}

// ── System health ─────────────────────────────────────────────────────────────

export interface SystemHealth {
  dbCounts: { table: string; count: number }[];
  unbalancedJournals: number;
  unbalancedByTenant: { tenantId: string; tenantName: string; count: number }[];
  importJobs: { status: string; count: number }[];
  failedImports: {
    id: string;
    tenantId: string;
    tenantName: string;
    stage: string;
    error: string | null;
    failed: number;
    createdAt: string;
  }[];
  authThrottleBlocks: number;
  inactiveUsers: number;
  staleTenants: { id: string; name: string; createdAt: string }[];
}

export async function getSystemHealth(): Promise<SystemHealth> {
  const now = new Date();
  const blockThreshold = now;
  const staleThreshold = daysAgoUtc(60);

  const [
    tenantCount, userCount, partyCount, billCount, paymentCount,
    journalCount, auditCount, bankCount, itemCount, importJobCount,
    unbalancedJournals, unbalancedGroups,
    importStatuses, failedImports,
    throttleBlocks, inactiveUsers, staleTenants,
  ] = await Promise.all([
    prisma.tenant.count(),
    prisma.user.count(),
    prisma.party.count(),
    prisma.bill.count(),
    prisma.payment.count(),
    prisma.journalEntry.count(),
    prisma.auditLog.count(),
    prisma.bankAccount.count(),
    prisma.itemCatalog.count(),
    prisma.importJob.count(),
    prisma.journalEntry.count({ where: { isBalanced: false, isDeleted: false } }),
    prisma.journalEntry.groupBy({
      by: ["tenantId"],
      where: { isBalanced: false, isDeleted: false },
      _count: { _all: true },
      orderBy: { _count: { tenantId: "desc" } },
      take: 10,
    }),
    prisma.importJob.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.importJob.findMany({
      where: { status: "FAILED" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true, tenantId: true, stage: true, error: true, failed: true, createdAt: true,
        tenant: { select: { name: true } },
      },
    }),
    prisma.authThrottle.count({ where: { blockedUntil: { gt: blockThreshold } } }),
    prisma.user.count({ where: { isActive: false } }),
    prisma.tenant.findMany({
      where: {
        createdAt: { lt: staleThreshold },
        bills: { none: { createdAt: { gte: staleThreshold } } },
        payments: { none: { createdAt: { gte: staleThreshold } } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, name: true, createdAt: true },
    }),
  ]);

  const tenantIds = unbalancedGroups.map((g) => g.tenantId);
  const tenantNames = tenantIds.length
    ? await prisma.tenant.findMany({
        where: { id: { in: tenantIds } },
        select: { id: true, name: true },
      })
    : [];
  const nameMap = new Map(tenantNames.map((t) => [t.id, t.name]));

  return {
    dbCounts: [
      { table: "Tenant", count: tenantCount },
      { table: "User", count: userCount },
      { table: "Party", count: partyCount },
      { table: "Bill", count: billCount },
      { table: "Payment", count: paymentCount },
      { table: "JournalEntry", count: journalCount },
      { table: "AuditLog", count: auditCount },
      { table: "BankAccount", count: bankCount },
      { table: "ItemCatalog", count: itemCount },
      { table: "ImportJob", count: importJobCount },
    ],
    unbalancedJournals,
    unbalancedByTenant: unbalancedGroups.map((g) => ({
      tenantId: g.tenantId,
      tenantName: nameMap.get(g.tenantId) ?? g.tenantId,
      count: g._count._all,
    })),
    importJobs: importStatuses.map((s) => ({ status: s.status, count: s._count._all })),
    failedImports: failedImports.map((j) => ({
      id: j.id, tenantId: j.tenantId, tenantName: j.tenant.name,
      stage: j.stage, error: j.error, failed: j.failed,
      createdAt: j.createdAt.toISOString(),
    })),
    authThrottleBlocks: throttleBlocks,
    inactiveUsers,
    staleTenants: staleTenants.map((t) => ({
      id: t.id, name: t.name, createdAt: t.createdAt.toISOString(),
    })),
  };
}

// ── Plan / revenue stats ──────────────────────────────────────────────────────

export interface PlanStats {
  distribution: { plan: string; count: number }[];
  conversionTrend: { label: string; free: number; pro: number }[];
  recentUpgrades: { id: string; name: string; plan: string; createdAt: string }[];
  churnRisk: { id: string; name: string; plan: string; createdAt: string; lastActivity: string | null }[];
  totals: {
    proTenants: number;
    proWithActivityLast30d: number;
    freeWithActivityLast30d: number;
  };
}

export async function getPlanStats(): Promise<PlanStats> {
  const d30 = daysAgoUtc(30);
  const d60 = daysAgoUtc(60);

  const months = monthBucketsUtc(6);
  const conversionTrend: { label: string; free: number; pro: number }[] = [];
  for (const m of months) {
    const [free, pro] = await Promise.all([
      prisma.tenant.count({ where: { plan: "FREE", createdAt: { gte: m.start, lt: m.end } } }),
      prisma.tenant.count({ where: { plan: "PRO", createdAt: { gte: m.start, lt: m.end } } }),
    ]);
    conversionTrend.push({ label: m.label, free, pro });
  }

  const [
    distribution, recentPro, proTotal,
    proActive30d, freeActive30d,
    churnCandidates,
  ] = await Promise.all([
    prisma.tenant.groupBy({ by: ["plan"], _count: { _all: true } }),
    prisma.tenant.findMany({
      where: { plan: "PRO" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, name: true, plan: true, createdAt: true },
    }),
    prisma.tenant.count({ where: { plan: "PRO" } }),
    prisma.bill.findMany({
      where: {
        createdAt: { gte: d30 },
        isDeleted: false,
        tenant: { plan: "PRO" },
      },
      distinct: ["tenantId"],
      select: { tenantId: true },
    }),
    prisma.bill.findMany({
      where: {
        createdAt: { gte: d30 },
        isDeleted: false,
        tenant: { plan: "FREE" },
      },
      distinct: ["tenantId"],
      select: { tenantId: true },
    }),
    prisma.tenant.findMany({
      where: {
        createdAt: { lt: d60 },
        bills: { none: { createdAt: { gte: d60 }, isDeleted: false } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, name: true, plan: true, createdAt: true },
    }),
  ]);

  const churnRisk = await Promise.all(
    churnCandidates.map(async (t) => {
      const last = await prisma.bill.findFirst({
        where: { tenantId: t.id, isDeleted: false },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      return {
        id: t.id, name: t.name, plan: t.plan,
        createdAt: t.createdAt.toISOString(),
        lastActivity: last?.createdAt.toISOString() ?? null,
      };
    })
  );

  return {
    distribution: distribution.map((d) => ({ plan: d.plan, count: d._count._all })),
    conversionTrend,
    recentUpgrades: recentPro.map((t) => ({
      id: t.id, name: t.name, plan: t.plan, createdAt: t.createdAt.toISOString(),
    })),
    churnRisk,
    totals: {
      proTenants: proTotal,
      proWithActivityLast30d: proActive30d.length,
      freeWithActivityLast30d: freeActive30d.length,
    },
  };
}

// ── Global search ─────────────────────────────────────────────────────────────

export interface GlobalSearchResult {
  tenants: { id: string; name: string; slug: string; plan: string }[];
  parties: { id: string; name: string; tenantId: string; tenantName: string; type: string; gstin: string | null }[];
  bills: { id: string; billNumber: string; tenantId: string; tenantName: string; customerName: string; grandTotal: number }[];
  users: { id: string; name: string; email: string | null; role: string; tenantId: string; tenantName: string }[];
}

export async function globalSearch(query: string): Promise<GlobalSearchResult> {
  const q = query.trim();
  if (q.length < 2) {
    return { tenants: [], parties: [], bills: [], users: [] };
  }
  const ci = { contains: q, mode: "insensitive" as const };

  const [tenants, parties, bills, users] = await Promise.all([
    prisma.tenant.findMany({
      where: { OR: [{ name: ci }, { slug: ci }, { gstin: ci }, { email: ci }, { phone: ci }] },
      take: 20,
      select: { id: true, name: true, slug: true, plan: true },
    }),
    prisma.party.findMany({
      where: { isDeleted: false, OR: [{ name: ci }, { gstin: ci }, { phone: ci }, { email: ci }] },
      take: 20,
      select: {
        id: true, name: true, tenantId: true, type: true, gstin: true,
        tenant: { select: { name: true } },
      },
    }),
    prisma.bill.findMany({
      where: { isDeleted: false, OR: [{ billNumber: ci }, { customerName: ci }, { gstin: ci }, { customerPhone: ci }] },
      take: 20,
      select: {
        id: true, billNumber: true, tenantId: true, customerName: true, grandTotal: true,
        tenant: { select: { name: true } },
      },
    }),
    prisma.user.findMany({
      where: { OR: [{ name: ci }, { email: ci }, { phone: ci }] },
      take: 20,
      select: {
        id: true, name: true, email: true, role: true, tenantId: true,
        tenant: { select: { name: true } },
      },
    }),
  ]);

  return {
    tenants,
    parties: parties.map((p) => ({
      id: p.id, name: p.name, tenantId: p.tenantId, tenantName: p.tenant.name,
      type: p.type, gstin: p.gstin,
    })),
    bills: bills.map((b) => ({
      id: b.id, billNumber: b.billNumber, tenantId: b.tenantId, tenantName: b.tenant.name,
      customerName: b.customerName, grandTotal: b.grandTotal.toNumber(),
    })),
    users: users.map((u) => ({
      id: u.id, name: u.name, email: u.email, role: u.role,
      tenantId: u.tenantId, tenantName: u.tenant.name,
    })),
  };
}
