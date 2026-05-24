/**
 * bank-balance.server.ts
 *
 * Server-only module. Mirrors party-balance.server.ts for BankAccount.
 *
 * Recomputes BankAccount.currentBalance from the Payment source of truth:
 *   currentBalance = openingBalance
 *                  + Σ(amount) where accountId = X, INCOMING, COMPLETED
 *                  − Σ(amount) where accountId = X, OUTGOING, COMPLETED  (incl. contra source leg)
 *                  + Σ(amount) where destinationAccountId = X, COMPLETED (contra dest leg)
 *
 * We derive from Payment, not JournalLine, because JournalLine.accountName is
 * the chart-of-accounts label (e.g. "Bank Account") — identical for every bank
 * account — and therefore cannot disambiguate which BankAccount a line belongs
 * to. Payment.accountId is the only per-account link in the data model.
 *
 * Used after bulk operations (e.g. Tally import) that create Payment rows
 * without going through the regular Payment APIs that increment/decrement
 * currentBalance inline.
 */

import { prisma } from "@/lib/prisma";

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function recomputeBankBalance(
  bankAccountId: string,
  tenantId: string,
  options: { dryRun?: boolean } = {}
): Promise<number> {
  return prisma.$transaction(
    async (tx: PrismaTx) => {
      const account = await tx.bankAccount.findFirst({
        where: { id: bankAccountId, tenantId },
        select: { openingBalance: true },
      });
      if (!account) throw new Error(`Bank account ${bankAccountId} not found`);

      const [direct, contraDest] = await Promise.all([
        tx.payment.findMany({
          where: {
            tenantId,
            accountId: bankAccountId,
            status: "COMPLETED",
            isDeleted: false,
          },
          select: { amount: true, direction: true },
        }),
        tx.payment.findMany({
          where: {
            tenantId,
            destinationAccountId: bankAccountId,
            status: "COMPLETED",
            isDeleted: false,
          },
          select: { amount: true },
        }),
      ]);

      const directDelta = direct.reduce(
        (sum: number, p: { amount: { toNumber: () => number }; direction: string }) =>
          sum + (p.direction === "INCOMING" ? p.amount.toNumber() : -p.amount.toNumber()),
        0
      );
      const contraDelta = contraDest.reduce(
        (sum: number, p: { amount: { toNumber: () => number } }) => sum + p.amount.toNumber(),
        0
      );

      const newBalance = account.openingBalance.toNumber() + directDelta + contraDelta;

      if (!options.dryRun) {
        await tx.bankAccount.update({
          where: { id: bankAccountId },
          data: { currentBalance: newBalance },
        });
      }

      return newBalance;
    },
    { isolationLevel: "RepeatableRead" }
  );
}
