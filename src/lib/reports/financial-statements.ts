import { prisma } from "@/lib/prisma";
import {
  CHART_OF_ACCOUNTS,
  type AccountCode,
  type AccountDefinition,
} from "@/lib/chart-of-accounts";
import { roundTo2 } from "@/lib/journal-reporting";

export interface AccountBalance {
  accountCode: string;
  accountName: string;
  tallyGroup: string;
  type: AccountDefinition["type"] | "UNKNOWN";
  normalBalance: AccountDefinition["normalBalance"] | "DEBIT";
  debit: number;
  credit: number;
  /** debit - credit (positive = net debit balance, negative = net credit) */
  net: number;
}

export interface GroupNode {
  name: string;
  total: number;
  accounts: AccountBalance[];
}

export interface ProfitLossReport {
  from: Date;
  to: Date;
  income: { groups: GroupNode[]; total: number };
  expense: { groups: GroupNode[]; total: number };
  netProfit: number;
  warnings: string[];
}

export interface BalanceSheetReport {
  asOf: Date;
  assets: { groups: GroupNode[]; total: number };
  liabilities: { groups: GroupNode[]; total: number };
  equity: { groups: GroupNode[]; total: number };
  retainedEarnings: number;
  liabilitiesAndEquityTotal: number;
  warnings: string[];
}

export interface LedgerLine {
  date: Date;
  journalId: string;
  voucherType: string;
  narration: string;
  partyName: string | null;
  debit: number;
  credit: number;
  balance: number;
}

export interface GeneralLedgerReport {
  accountCode: string;
  accountName: string;
  tallyGroup: string;
  from: Date;
  to: Date;
  openingBalance: number;
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
  lines: LedgerLine[];
}

export interface DayBookVoucherLine {
  accountCode: string;
  accountName: string;
  partyName: string | null;
  debit: number;
  credit: number;
}

export interface DayBookVoucher {
  journalId: string;
  voucherType: string;
  narration: string;
  entryDate: Date;
  totalDebit: number;
  totalCredit: number;
  lines: DayBookVoucherLine[];
}

export interface DayBookReport {
  from: Date;
  to: Date;
  days: {
    date: string;
    vouchers: DayBookVoucher[];
    totalDebit: number;
    totalCredit: number;
  }[];
  totalDebit: number;
  totalCredit: number;
}

export interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  tallyGroup: string;
  type: AccountDefinition["type"] | "UNKNOWN";
  totalDebit: number;
  totalCredit: number;
  closingDebit: number;
  closingCredit: number;
}

export interface TrialBalanceReport {
  from: Date;
  to: Date;
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

interface AggregateRow {
  accountCode: string;
  accountName: string;
  tallyGroup: string;
  debit: number;
  credit: number;
}

/**
 * Aggregate JournalLine debit/credit per account for entries in [from, to].
 * `from` may be undefined to mean "since inception".
 */
async function aggregateAccountBalances(
  tenantId: string,
  to: Date,
  from?: Date
): Promise<AggregateRow[]> {
  const grouped = await prisma.journalLine.groupBy({
    by: ["accountCode", "accountName", "tallyGroup"],
    where: {
      journal: {
        tenantId,
        isDeleted: false,
        entryDate: from ? { gte: from, lte: to } : { lte: to },
      },
    },
    _sum: { debit: true, credit: true },
  });

  return grouped.map((g) => ({
    accountCode: g.accountCode,
    accountName: g.accountName,
    tallyGroup: g.tallyGroup,
    debit: g._sum.debit ? Number(g._sum.debit) : 0,
    credit: g._sum.credit ? Number(g._sum.credit) : 0,
  }));
}

function toAccountBalance(row: AggregateRow): AccountBalance {
  const def = CHART_OF_ACCOUNTS[row.accountCode as AccountCode];
  const debit = roundTo2(row.debit);
  const credit = roundTo2(row.credit);
  return {
    accountCode: row.accountCode,
    accountName: row.accountName,
    tallyGroup: row.tallyGroup,
    type: def?.type ?? "UNKNOWN",
    normalBalance: def?.normalBalance ?? "DEBIT",
    debit,
    credit,
    net: roundTo2(debit - credit),
  };
}

function groupByTallyGroup(
  balances: AccountBalance[],
  signFor: "DEBIT" | "CREDIT"
): { groups: GroupNode[]; total: number } {
  const map = new Map<string, AccountBalance[]>();
  for (const b of balances) {
    if (!map.has(b.tallyGroup)) map.set(b.tallyGroup, []);
    map.get(b.tallyGroup)!.push(b);
  }

  const groups: GroupNode[] = [];
  let total = 0;
  for (const [name, accounts] of map.entries()) {
    accounts.sort((a, b) => a.accountName.localeCompare(b.accountName));
    let groupTotal = 0;
    for (const a of accounts) {
      const amount = signFor === "DEBIT" ? a.net : -a.net;
      groupTotal += amount;
    }
    groupTotal = roundTo2(groupTotal);
    total += groupTotal;
    groups.push({ name, accounts, total: groupTotal });
  }
  groups.sort((a, b) => a.name.localeCompare(b.name));
  return { groups, total: roundTo2(total) };
}

async function countUnbalanced(tenantId: string, from: Date, to: Date): Promise<number> {
  return prisma.journalEntry.count({
    where: {
      tenantId,
      isDeleted: false,
      isBalanced: false,
      entryDate: { gte: from, lte: to },
    },
  });
}

export async function getProfitAndLoss(
  tenantId: string,
  from: Date,
  to: Date
): Promise<ProfitLossReport> {
  const [rows, unbalanced] = await Promise.all([
    aggregateAccountBalances(tenantId, to, from),
    countUnbalanced(tenantId, from, to),
  ]);

  const balances = rows.map(toAccountBalance);
  const income = balances.filter((b) => b.type === "INCOME");
  const expense = balances.filter((b) => b.type === "EXPENSE");

  const incomeGroups = groupByTallyGroup(income, "CREDIT");
  const expenseGroups = groupByTallyGroup(expense, "DEBIT");

  const warnings: string[] = [];
  if (unbalanced > 0) {
    warnings.push(
      `${unbalanced} unbalanced journal entries in this period. Report may be inaccurate.`
    );
  }

  return {
    from,
    to,
    income: incomeGroups,
    expense: expenseGroups,
    netProfit: roundTo2(incomeGroups.total - expenseGroups.total),
    warnings,
  };
}

export async function getBalanceSheet(
  tenantId: string,
  asOf: Date
): Promise<BalanceSheetReport> {
  const [rows, unbalanced] = await Promise.all([
    aggregateAccountBalances(tenantId, asOf),
    prisma.journalEntry.count({
      where: {
        tenantId,
        isDeleted: false,
        isBalanced: false,
        entryDate: { lte: asOf },
      },
    }),
  ]);

  const balances = rows.map(toAccountBalance);

  const assets = groupByTallyGroup(
    balances.filter((b) => b.type === "ASSET"),
    "DEBIT"
  );
  const liabilities = groupByTallyGroup(
    balances.filter((b) => b.type === "LIABILITY"),
    "CREDIT"
  );
  const equity = groupByTallyGroup(
    balances.filter((b) => b.type === "EQUITY"),
    "CREDIT"
  );

  const incomeTotal = balances
    .filter((b) => b.type === "INCOME")
    .reduce((sum, b) => sum + -b.net, 0);
  const expenseTotal = balances
    .filter((b) => b.type === "EXPENSE")
    .reduce((sum, b) => sum + b.net, 0);
  const retainedEarnings = roundTo2(incomeTotal - expenseTotal);

  const warnings: string[] = [];
  if (unbalanced > 0) {
    warnings.push(
      `${unbalanced} unbalanced journal entries up to this date. Report may be inaccurate.`
    );
  }

  const liabilitiesAndEquityTotal = roundTo2(
    liabilities.total + equity.total + retainedEarnings
  );

  if (Math.abs(assets.total - liabilitiesAndEquityTotal) > 0.5) {
    warnings.push(
      `Assets (${assets.total}) do not match Liabilities + Equity (${liabilitiesAndEquityTotal}). Check unposted opening balances.`
    );
  }

  return {
    asOf,
    assets,
    liabilities,
    equity,
    retainedEarnings,
    liabilitiesAndEquityTotal,
    warnings,
  };
}

export async function getGeneralLedger(
  tenantId: string,
  accountCode: string,
  from: Date,
  to: Date
): Promise<GeneralLedgerReport> {
  const def = CHART_OF_ACCOUNTS[accountCode as AccountCode];
  if (!def) {
    throw new Error(`Unknown account code: ${accountCode}`);
  }

  // Opening: sum of lines before `from`.
  const openingAgg = await prisma.journalLine.aggregate({
    where: {
      accountCode,
      journal: {
        tenantId,
        isDeleted: false,
        entryDate: { lt: from },
      },
    },
    _sum: { debit: true, credit: true },
  });

  const openingDebit = openingAgg._sum.debit ? Number(openingAgg._sum.debit) : 0;
  const openingCredit = openingAgg._sum.credit ? Number(openingAgg._sum.credit) : 0;
  const openingBalance = roundTo2(openingDebit - openingCredit);

  const lines = await prisma.journalLine.findMany({
    where: {
      accountCode,
      journal: {
        tenantId,
        isDeleted: false,
        entryDate: { gte: from, lte: to },
      },
    },
    select: {
      debit: true,
      credit: true,
      partyName: true,
      journal: {
        select: {
          id: true,
          entryDate: true,
          narration: true,
          voucherType: true,
        },
      },
    },
    orderBy: [{ journal: { entryDate: "asc" } }, { journal: { createdAt: "asc" } }],
  });

  let running = openingBalance;
  let totalDebit = 0;
  let totalCredit = 0;
  const ledgerLines: LedgerLine[] = lines.map((l) => {
    const debit = Number(l.debit);
    const credit = Number(l.credit);
    running = roundTo2(running + debit - credit);
    totalDebit += debit;
    totalCredit += credit;
    return {
      date: l.journal.entryDate,
      journalId: l.journal.id,
      voucherType: l.journal.voucherType,
      narration: l.journal.narration,
      partyName: l.partyName,
      debit: roundTo2(debit),
      credit: roundTo2(credit),
      balance: running,
    };
  });

  return {
    accountCode,
    accountName: def.name,
    tallyGroup: def.tallyGroup,
    from,
    to,
    openingBalance,
    closingBalance: running,
    totalDebit: roundTo2(totalDebit),
    totalCredit: roundTo2(totalCredit),
    lines: ledgerLines,
  };
}

export async function getDayBook(
  tenantId: string,
  from: Date,
  to: Date
): Promise<DayBookReport> {
  const entries = await prisma.journalEntry.findMany({
    where: {
      tenantId,
      isDeleted: false,
      entryDate: { gte: from, lte: to },
    },
    orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      entryDate: true,
      narration: true,
      voucherType: true,
      totalDebit: true,
      totalCredit: true,
      lines: {
        select: {
          accountCode: true,
          accountName: true,
          partyName: true,
          debit: true,
          credit: true,
        },
      },
    },
  });

  const dayMap = new Map<
    string,
    { vouchers: DayBookVoucher[]; totalDebit: number; totalCredit: number }
  >();

  let totalDebit = 0;
  let totalCredit = 0;

  const istFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  for (const e of entries) {
    const dayKey = istFormatter.format(e.entryDate);
    const voucher: DayBookVoucher = {
      journalId: e.id,
      voucherType: e.voucherType,
      narration: e.narration,
      entryDate: e.entryDate,
      totalDebit: roundTo2(Number(e.totalDebit)),
      totalCredit: roundTo2(Number(e.totalCredit)),
      lines: e.lines.map((l) => ({
        accountCode: l.accountCode,
        accountName: l.accountName,
        partyName: l.partyName,
        debit: roundTo2(Number(l.debit)),
        credit: roundTo2(Number(l.credit)),
      })),
    };
    totalDebit += voucher.totalDebit;
    totalCredit += voucher.totalCredit;

    if (!dayMap.has(dayKey)) {
      dayMap.set(dayKey, { vouchers: [], totalDebit: 0, totalCredit: 0 });
    }
    const bucket = dayMap.get(dayKey)!;
    bucket.vouchers.push(voucher);
    bucket.totalDebit += voucher.totalDebit;
    bucket.totalCredit += voucher.totalCredit;
  }

  const days = [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, b]) => ({
      date,
      vouchers: b.vouchers,
      totalDebit: roundTo2(b.totalDebit),
      totalCredit: roundTo2(b.totalCredit),
    }));

  return {
    from,
    to,
    days,
    totalDebit: roundTo2(totalDebit),
    totalCredit: roundTo2(totalCredit),
  };
}

export async function getTrialBalance(
  tenantId: string,
  from: Date,
  to: Date
): Promise<TrialBalanceReport> {
  const rows = await aggregateAccountBalances(tenantId, to, from);

  const trialRows: TrialBalanceRow[] = rows
    .map((row) => {
      const def = CHART_OF_ACCOUNTS[row.accountCode as AccountCode];
      const totalDebit = roundTo2(row.debit);
      const totalCredit = roundTo2(row.credit);
      const net = roundTo2(totalDebit - totalCredit);
      return {
        accountCode: row.accountCode,
        accountName: row.accountName,
        tallyGroup: row.tallyGroup,
        type: def?.type ?? ("UNKNOWN" as const),
        totalDebit,
        totalCredit,
        closingDebit: net > 0 ? net : 0,
        closingCredit: net < 0 ? Math.abs(net) : 0,
      };
    })
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode));

  const totalDebit = roundTo2(trialRows.reduce((s, r) => s + r.totalDebit, 0));
  const totalCredit = roundTo2(trialRows.reduce((s, r) => s + r.totalCredit, 0));

  return {
    from,
    to,
    rows: trialRows,
    totalDebit,
    totalCredit,
    isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
  };
}
