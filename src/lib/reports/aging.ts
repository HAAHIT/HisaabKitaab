import { prisma } from "@/lib/prisma";
import { roundTo2 } from "@/lib/journal-reporting";

export interface AgingBuckets {
  current: number;
  days_31_60: number;
  days_61_90: number;
  days_90_plus: number;
  total: number;
}

export interface AgingPartyRow extends AgingBuckets {
  partyId: string;
  partyName: string;
}

export interface AgingSide {
  buckets: AgingBuckets;
  parties: AgingPartyRow[];
}

export interface AgingReport {
  asOf: Date;
  receivable: AgingSide;
  payable: AgingSide;
}

function emptyBuckets(): AgingBuckets {
  return {
    current: 0,
    days_31_60: 0,
    days_61_90: 0,
    days_90_plus: 0,
    total: 0,
  };
}

function bucketFor(daysOld: number): keyof Omit<AgingBuckets, "total"> {
  if (daysOld <= 30) return "current";
  if (daysOld <= 60) return "days_31_60";
  if (daysOld <= 90) return "days_61_90";
  return "days_90_plus";
}

export async function getAging(tenantId: string, asOf: Date): Promise<AgingReport> {
  const bills = await prisma.bill.findMany({
    where: {
      tenantId,
      isDeleted: false,
      status: "FINAL",
      date: { lte: asOf },
    },
    select: {
      id: true,
      date: true,
      grandTotal: true,
      partyId: true,
      customerName: true,
      party: { select: { id: true, name: true, type: true } },
    },
  });

  if (bills.length === 0) {
    return {
      asOf,
      receivable: { buckets: emptyBuckets(), parties: [] },
      payable: { buckets: emptyBuckets(), parties: [] },
    };
  }

  const billIds = bills.map((b) => b.id);

  const paymentSums = await prisma.payment.groupBy({
    by: ["linkedBillId"],
    where: {
      tenantId,
      isDeleted: false,
      status: "COMPLETED",
      linkedBillId: { in: billIds },
      date: { lte: asOf },
    },
    _sum: { amount: true },
  });

  const paidMap = new Map<string, number>();
  for (const p of paymentSums) {
    if (p.linkedBillId) {
      paidMap.set(p.linkedBillId, p._sum.amount ? Number(p._sum.amount) : 0);
    }
  }

  const receivableParties = new Map<string, AgingPartyRow>();
  const payableParties = new Map<string, AgingPartyRow>();

  for (const bill of bills) {
    const grandTotal = Number(bill.grandTotal);
    const paid = paidMap.get(bill.id) ?? 0;
    const outstanding = roundTo2(grandTotal - paid);
    if (outstanding <= 0) continue;

    const daysOld = Math.floor(
      (asOf.getTime() - bill.date.getTime()) / (1000 * 60 * 60 * 24)
    );
    const bucket = bucketFor(daysOld);

    const partyType = bill.party?.type ?? "CUSTOMER";
    const target =
      partyType === "VENDOR" || partyType === "LIABILITY"
        ? payableParties
        : receivableParties;

    const partyId = bill.party?.id ?? `unmapped:${bill.customerName}`;
    const partyName = bill.party?.name ?? bill.customerName ?? "Unknown";

    let row = target.get(partyId);
    if (!row) {
      row = { partyId, partyName, ...emptyBuckets() };
      target.set(partyId, row);
    }
    row[bucket] += outstanding;
    row.total += outstanding;
  }

  function summarize(map: Map<string, AgingPartyRow>): AgingSide {
    const buckets = emptyBuckets();
    const parties = [...map.values()]
      .map((p) => ({
        partyId: p.partyId,
        partyName: p.partyName,
        current: roundTo2(p.current),
        days_31_60: roundTo2(p.days_31_60),
        days_61_90: roundTo2(p.days_61_90),
        days_90_plus: roundTo2(p.days_90_plus),
        total: roundTo2(p.total),
      }))
      .sort((a, b) => b.total - a.total);

    for (const p of parties) {
      buckets.current += p.current;
      buckets.days_31_60 += p.days_31_60;
      buckets.days_61_90 += p.days_61_90;
      buckets.days_90_plus += p.days_90_plus;
      buckets.total += p.total;
    }

    return {
      buckets: {
        current: roundTo2(buckets.current),
        days_31_60: roundTo2(buckets.days_31_60),
        days_61_90: roundTo2(buckets.days_61_90),
        days_90_plus: roundTo2(buckets.days_90_plus),
        total: roundTo2(buckets.total),
      },
      parties,
    };
  }

  return {
    asOf,
    receivable: summarize(receivableParties),
    payable: summarize(payableParties),
  };
}
