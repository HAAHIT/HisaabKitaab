import { prisma } from "@/lib/prisma";
import {
  CHART_OF_ACCOUNTS,
  type AccountCode,
} from "@/lib/chart-of-accounts";
import { createJournalEntry } from "@/lib/journal";
import { roundTo2 } from "@/lib/journal-reporting";

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export interface ClosingPreviewLine {
  accountCode: AccountCode;
  accountName: string;
  type: "INCOME" | "EXPENSE";
  balance: number;
}

export interface ClosingPreview {
  fyStartYear: number;
  fyLabel: string;
  fyStart: Date;
  fyEnd: Date;
  incomeLines: ClosingPreviewLine[];
  expenseLines: ClosingPreviewLine[];
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  alreadyClosed: boolean;
}

interface TenantSettingsShape {
  closedFinancialYears?: number[];
}

function fyBoundaries(fyStartYear: number): { start: Date; end: Date; label: string } {
  // IST midnight Apr 1 fyStartYear → end of Mar 31 (fyStartYear + 1)
  // Stored UTC: IST midnight = previous day 18:30 UTC.
  const start = new Date(Date.UTC(fyStartYear, 3, 1, -5, -30, 0, 0));
  const end = new Date(Date.UTC(fyStartYear + 1, 2, 31, 18, 29, 59, 999));
  const label = `FY ${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`;
  return { start, end, label };
}

async function getTenantSettings(
  tenantId: string,
  tx?: PrismaTx
): Promise<TenantSettingsShape> {
  const client = tx ?? prisma;
  const tenant = await client.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  if (!tenant) throw new Error("Tenant not found");
  return (tenant.settings as TenantSettingsShape) || {};
}

export async function getClosingPreview(
  tenantId: string,
  fyStartYear: number
): Promise<ClosingPreview> {
  const { start, end, label } = fyBoundaries(fyStartYear);

  const grouped = await prisma.journalLine.groupBy({
    by: ["accountCode"],
    where: {
      journal: {
        tenantId,
        isDeleted: false,
        entryDate: { gte: start, lte: end },
      },
    },
    _sum: { debit: true, credit: true },
  });

  const incomeLines: ClosingPreviewLine[] = [];
  const expenseLines: ClosingPreviewLine[] = [];

  for (const g of grouped) {
    const def = CHART_OF_ACCOUNTS[g.accountCode as AccountCode];
    if (!def) continue;
    if (def.type !== "INCOME" && def.type !== "EXPENSE") continue;

    const debit = g._sum.debit ? Number(g._sum.debit) : 0;
    const credit = g._sum.credit ? Number(g._sum.credit) : 0;
    const net = roundTo2(debit - credit);

    if (def.type === "INCOME") {
      const balance = roundTo2(-net);
      if (Math.abs(balance) < 0.01) continue;
      incomeLines.push({
        accountCode: def.code,
        accountName: def.name,
        type: "INCOME",
        balance,
      });
    } else {
      const balance = roundTo2(net);
      if (Math.abs(balance) < 0.01) continue;
      expenseLines.push({
        accountCode: def.code,
        accountName: def.name,
        type: "EXPENSE",
        balance,
      });
    }
  }

  incomeLines.sort((a, b) => a.accountName.localeCompare(b.accountName));
  expenseLines.sort((a, b) => a.accountName.localeCompare(b.accountName));

  const totalIncome = roundTo2(
    incomeLines.reduce((s, l) => s + l.balance, 0)
  );
  const totalExpense = roundTo2(
    expenseLines.reduce((s, l) => s + l.balance, 0)
  );
  const netProfit = roundTo2(totalIncome - totalExpense);

  const settings = await getTenantSettings(tenantId);
  const alreadyClosed =
    Array.isArray(settings.closedFinancialYears) &&
    settings.closedFinancialYears.includes(fyStartYear);

  return {
    fyStartYear,
    fyLabel: label,
    fyStart: start,
    fyEnd: end,
    incomeLines,
    expenseLines,
    totalIncome,
    totalExpense,
    netProfit,
    alreadyClosed,
  };
}

export async function executeYearEndClose(
  tenantId: string,
  fyStartYear: number,
  createdBy: string
): Promise<{ journalId: string; netProfit: number }> {
  return prisma.$transaction(async (tx) => {
    const settings = await getTenantSettings(tenantId, tx);
    const alreadyClosed =
      Array.isArray(settings.closedFinancialYears) &&
      settings.closedFinancialYears.includes(fyStartYear);
    if (alreadyClosed) {
      throw new Error(`FY ${fyStartYear} is already closed.`);
    }

    const unbalanced = await tx.journalEntry.count({
      where: {
        tenantId,
        isDeleted: false,
        isBalanced: false,
        entryDate: {
          gte: fyBoundaries(fyStartYear).start,
          lte: fyBoundaries(fyStartYear).end,
        },
      },
    });
    if (unbalanced > 0) {
      throw new Error(
        `Cannot close FY: ${unbalanced} unbalanced journal entries exist. Fix them first.`
      );
    }

    const preview = await getClosingPreview(tenantId, fyStartYear);

    if (preview.incomeLines.length === 0 && preview.expenseLines.length === 0) {
      throw new Error("No income or expense activity to close in this FY.");
    }

    const lines: {
      accountCode: AccountCode;
      debit: number;
      credit: number;
    }[] = [];

    // Zero out income (normal credit balance) by debiting it.
    for (const l of preview.incomeLines) {
      lines.push({
        accountCode: l.accountCode as AccountCode,
        debit: l.balance,
        credit: 0,
      });
    }

    // Zero out expense (normal debit balance) by crediting it.
    for (const l of preview.expenseLines) {
      lines.push({
        accountCode: l.accountCode as AccountCode,
        debit: 0,
        credit: l.balance,
      });
    }

    // Transfer net to retained earnings (Owner Equity / Capital).
    if (Math.abs(preview.netProfit) >= 0.01) {
      if (preview.netProfit > 0) {
        lines.push({
          accountCode: "OWNER_EQUITY",
          debit: 0,
          credit: preview.netProfit,
        });
      } else {
        lines.push({
          accountCode: "OWNER_EQUITY",
          debit: -preview.netProfit,
          credit: 0,
        });
      }
    }

    const entry = await createJournalEntry(tx, {
      tenantId,
      entryDate: preview.fyEnd,
      narration: `Year-end closing entry for ${preview.fyLabel}`,
      voucherType: "JOURNAL",
      createdBy,
      lines,
    });

    const updatedYears = [
      ...(settings.closedFinancialYears ?? []),
      fyStartYear,
    ];
    const newSettings: TenantSettingsShape = {
      ...settings,
      closedFinancialYears: updatedYears,
    };

    await tx.tenant.update({
      where: { id: tenantId },
      data: { settings: newSettings as object },
    });

    return { journalId: entry.id, netProfit: preview.netProfit };
  });
}

/**
 * Reverse a year-end close while still in the active FY. Posts a balanced
 * reversing JOURNAL entry that negates the original closing entry (debits and
 * credits swapped) and removes the FY from `closedFinancialYears`. The original
 * closing entry is left intact for the audit trail — we never hard-delete.
 */
export async function reverseYearEndClose(
  tenantId: string,
  fyStartYear: number,
  createdBy: string
): Promise<{ journalId: string }> {
  return prisma.$transaction(async (tx) => {
    const settings = await getTenantSettings(tenantId, tx);
    const isClosed =
      Array.isArray(settings.closedFinancialYears) &&
      settings.closedFinancialYears.includes(fyStartYear);
    if (!isClosed) {
      throw new Error(`FY ${fyStartYear} is not closed; nothing to reverse.`);
    }

    const { start, end } = fyBoundaries(fyStartYear);

    const closing = await tx.journalEntry.findFirst({
      where: {
        tenantId,
        isDeleted: false,
        voucherType: "JOURNAL",
        narration: { startsWith: "Year-end closing entry for" },
        entryDate: { gte: start, lte: end },
      },
      orderBy: { createdAt: "desc" },
      include: { lines: true },
    });
    if (!closing) {
      throw new Error("Original closing entry not found; cannot reverse.");
    }

    const alreadyReversed = await tx.journalEntry.findFirst({
      where: {
        tenantId,
        isDeleted: false,
        voucherType: "JOURNAL",
        narration: { startsWith: "Reversal of year-end closing entry for" },
        entryDate: { gte: start, lte: end },
      },
      select: { id: true },
    });
    if (alreadyReversed) {
      throw new Error("This year-end close has already been reversed.");
    }

    // Swap debit/credit on every line to negate the closing entry.
    const reversedLines = closing.lines.map((l) => ({
      accountCode: l.accountCode as AccountCode,
      debit: roundTo2(l.credit.toNumber()),
      credit: roundTo2(l.debit.toNumber()),
    }));

    const entry = await createJournalEntry(tx, {
      tenantId,
      entryDate: end,
      narration: closing.narration.replace(
        "Year-end closing entry for",
        "Reversal of year-end closing entry for"
      ),
      voucherType: "JOURNAL",
      createdBy,
      lines: reversedLines,
    });

    const updatedYears = (settings.closedFinancialYears ?? []).filter(
      (y) => y !== fyStartYear
    );
    await tx.tenant.update({
      where: { id: tenantId },
      data: { settings: { ...settings, closedFinancialYears: updatedYears } as object },
    });

    return { journalId: entry.id };
  });
}

export async function getClosedFinancialYears(tenantId: string): Promise<number[]> {
  const settings = await getTenantSettings(tenantId);
  return settings.closedFinancialYears ?? [];
}
