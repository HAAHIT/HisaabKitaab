/**
 * party-balance.server.ts
 *
 * Server-only module. DO NOT import from client components.
 * The prisma client transitively requires Node.js built-ins (dns, net, tls)
 * that are unavailable in the browser bundle.
 *
 * Kept separate from accounting.ts precisely because accounting.ts is consumed
 * by client components (e.g. PartySearch) for its pure helper functions.
 */

import { prisma } from "@/lib/prisma";
import {
  getBillBalanceDelta,
  getPaymentBalanceDelta,
  type SupportedPartyType,
  type SupportedPayDirection,
} from "@/lib/accounting";

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Recomputes a party's balance from the source-of-truth records (bills +
 * payments) and atomically writes the result to `Party.currentBalance`.
 *
 * Wrapped in a **RepeatableRead** transaction to prevent lost-update race
 * conditions: the snapshot of bills and payments is taken at the same
 * transaction timestamp as the subsequent `Party.update`, so no concurrent
 * payment/bill write can slip between the read and the write.
 *
 * @param _db  Ignored — kept for call-site backwards-compatibility. The
 *             function always opens its own RepeatableRead transaction.
 * @returns    The newly computed balance.
 */
export async function recomputePartyBalance(
  _db: unknown,
  partyId: string,
  tenantId: string
): Promise<number> {
  return prisma.$transaction(
    async (tx: PrismaTx) => {
      const party = await tx.party.findFirst({
        where: { id: partyId, tenantId },
        select: { openingBalance: true, type: true },
      });

      if (!party) throw new Error(`Party ${partyId} not found`);

      const [bills, payments, noteLines] = await Promise.all([
        tx.bill.findMany({
          where: { partyId, tenantId, status: "FINAL", isDeleted: false },
          select: { grandTotal: true },
        }),
        tx.payment.findMany({
          where: { partyId, tenantId, status: "COMPLETED", isDeleted: false },
          select: { amount: true, direction: true },
        }),
        // Query the party-specific JournalLine rows for all CREDIT_NOTE / DEBIT_NOTE entries.
        // This mirrors the sign convention in buildPartyLedger (accounting.ts:296-299):
        //   CREDIT_NOTE party line → credit = grandTotal, debit = 0  → delta = +(credit − debit)
        //   DEBIT_NOTE  party line → debit = grandTotal, credit = 0  → delta = +(debit − credit)
        // Both add +grandTotal to balance (outstanding amount is reduced in both cases).
        // Using JournalLine directly is defensive: it remains correct even if a JournalEntry
        // is somehow stored with isBalanced=false (totalDebit ≠ grandTotal).
        tx.journalLine.findMany({
          where: {
            partyId,
            journal: {
              tenantId,
              isDeleted: false,
              voucherType: { in: ["CREDIT_NOTE", "DEBIT_NOTE"] },
            },
          },
          select: {
            debit: true,
            credit: true,
            journal: { select: { voucherType: true } },
          },
        }),
      ]);

      const billDelta = bills.reduce(
        (sum: number, b: { grandTotal: { toNumber: () => number } }) =>
          sum + getBillBalanceDelta(party.type as SupportedPartyType, b.grandTotal.toNumber()),
        0
      );
      const paymentDelta = payments.reduce(
        (sum: number, p: { amount: { toNumber: () => number }; direction: string }) =>
          sum +
          getPaymentBalanceDelta(
            party.type as SupportedPartyType,
            p.direction as SupportedPayDirection,
            p.amount.toNumber()
          ),
        0
      );
      const noteDelta = noteLines.reduce(
        (
          sum: number,
          line: {
            debit: { toNumber: () => number };
            credit: { toNumber: () => number };
            journal: { voucherType: string };
          }
        ) => {
          const d = line.debit.toNumber();
          const c = line.credit.toNumber();
          // DEBIT_NOTE party line is a debit (debit > credit) → positive delta.
          // CREDIT_NOTE party line is a credit (credit > debit) → positive delta.
          return sum + (line.journal.voucherType === "DEBIT_NOTE" ? d - c : c - d);
        },
        0
      );

      const newBalance =
        party.openingBalance.toNumber() + billDelta + paymentDelta + noteDelta;

      await tx.party.update({
        where: { id: partyId },
        data: { currentBalance: newBalance },
      });

      return newBalance;
    },
    { isolationLevel: "RepeatableRead" }
  );
}
