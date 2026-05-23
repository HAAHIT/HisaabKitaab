import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSession } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";
import { generateLockKey } from "@/lib/locks";
import { getIstCalendar, istMidnightUtc } from "@/lib/journal-reporting";

export const runtime = "nodejs";

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

interface FlatSettings {
  billPrefix?: string;
}

function parseFlatSettings(value: unknown): FlatSettings {
  if (!value || typeof value !== "object") return {};
  return value as FlatSettings;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, role, userId } = sessionResolution.session;

  if (role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const source = await prisma.bill.findFirst({
      where: { id, tenantId, isDeleted: false },
    });
    if (!source) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const settings = parseFlatSettings(tenant?.settings);
    const prefix = (settings.billPrefix && settings.billPrefix.trim()) || "BILL";

    const newDate = new Date();
    const ist = getIstCalendar(newDate);
    const yearMonth = `${ist.year}${String(ist.month + 1).padStart(2, "0")}`;
    const monthStart = istMidnightUtc(ist.year, ist.month, 1);
    const nextMonthStart = istMidnightUtc(ist.year, ist.month + 1, 1);

    const newBill = await prisma.$transaction(async (tx: PrismaTx) => {
      const lockKey = generateLockKey(tenantId);
      await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

      const lastBill = await tx.bill.findFirst({
        where: {
          tenantId,
          billNumber: { startsWith: prefix },
          createdAt: { gte: monthStart, lt: nextMonthStart },
        },
        orderBy: { billNumber: "desc" },
        select: { billNumber: true },
      });
      let nextSeq = 1;
      if (lastBill?.billNumber) {
        const parts = lastBill.billNumber.split("-");
        const lastSeq = parseInt(parts[parts.length - 1], 10);
        if (!Number.isNaN(lastSeq)) nextSeq = lastSeq + 1;
      }
      const billNumber = `${prefix}-${yearMonth}-${String(nextSeq).padStart(3, "0")}`;

      return tx.bill.create({
        data: {
          tenantId,
          billNumber,
          templateId: source.templateId,
          partyId: source.partyId,
          customerName: source.customerName,
          customerPhone: source.customerPhone,
          customerAddress: source.customerAddress,
          shippingAddress: source.shippingAddress,
          gstin: source.gstin,
          rows: source.rows ?? [],
          notes: source.notes,
          terms: source.terms,
          subtotal: source.subtotal,
          taxPercent: source.taxPercent,
          taxAmount: source.taxAmount,
          cessAmount: source.cessAmount,
          grandTotal: source.grandTotal,
          roundOff: source.roundOff,
          isInterState: source.isInterState,
          placeOfSupply: source.placeOfSupply,
          hsnCode: source.hsnCode,
          status: "DRAFT",
          createdBy: userId,
          date: newDate,
        },
        select: { id: true, billNumber: true },
      });
    });

    return NextResponse.json({ data: newBill });
  } catch (error) {
    logError("bills.duplicate.error", {
      requestId: getRequestId(request),
      error,
    });
    return NextResponse.json(
      { error: "Failed to duplicate bill" },
      { status: 500 }
    );
  }
}
