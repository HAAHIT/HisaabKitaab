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

      const [bills, payments] = await Promise.all([
        tx.bill.findMany({
          where: { partyId, tenantId, status: "FINAL", isDeleted: false },
          select: { grandTotal: true },
        }),
        tx.payment.findMany({
          where: { partyId, tenantId, status: "COMPLETED", isDeleted: false },
          select: { amount: true, direction: true },
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

      const newBalance =
        party.openingBalance.toNumber() + billDelta + paymentDelta;

      await tx.party.update({
        where: { id: partyId },
        data: { currentBalance: newBalance },
      });

      return newBalance;
    },
    { isolationLevel: "RepeatableRead" }
  );
}
