import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSession } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";

export const runtime = "nodejs";

const PER_TYPE_LIMIT = 8;

export async function GET(request: NextRequest) {
  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, role } = sessionResolution.session;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();

  if (q.length < 2) {
    return NextResponse.json({
      data: { bills: [], parties: [], items: [] },
    });
  }

  const canSeeAll = role !== "CUSTOMER";

  try {
    const [bills, parties, items] = await Promise.all([
      canSeeAll
        ? prisma.bill.findMany({
            where: {
              tenantId,
              isDeleted: false,
              OR: [
                { billNumber: { contains: q, mode: "insensitive" } },
                { customerName: { contains: q, mode: "insensitive" } },
                { gstin: { contains: q, mode: "insensitive" } },
              ],
            },
            select: {
              id: true,
              billNumber: true,
              customerName: true,
              grandTotal: true,
              status: true,
              date: true,
            },
            orderBy: { createdAt: "desc" },
            take: PER_TYPE_LIMIT,
          })
        : Promise.resolve([]),

      canSeeAll
        ? prisma.party.findMany({
            where: {
              tenantId,
              isDeleted: false,
              isActive: true,
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { phone: { contains: q } },
                { gstin: { contains: q, mode: "insensitive" } },
              ],
            },
            select: {
              id: true,
              name: true,
              type: true,
              phone: true,
              currentBalance: true,
            },
            orderBy: { name: "asc" },
            take: PER_TYPE_LIMIT,
          })
        : Promise.resolve([]),

      canSeeAll
        ? prisma.itemCatalog.findMany({
            where: {
              tenantId,
              isActive: true,
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { hsnCode: { contains: q, mode: "insensitive" } },
              ],
            },
            select: { id: true, name: true, hsnCode: true, rate: true, unit: true },
            orderBy: { name: "asc" },
            take: PER_TYPE_LIMIT,
          })
        : Promise.resolve([]),
    ]);

    return NextResponse.json({
      data: {
        bills: bills.map((b) => ({
          id: b.id,
          billNumber: b.billNumber,
          customerName: b.customerName,
          grandTotal: Number(b.grandTotal),
          status: b.status,
          date: b.date,
        })),
        parties: parties.map((p) => ({
          id: p.id,
          name: p.name,
          type: p.type,
          phone: p.phone,
          currentBalance: Number(p.currentBalance),
        })),
        items: items.map((i) => ({
          id: i.id,
          name: i.name,
          hsnCode: i.hsnCode,
          unit: i.unit,
          rate: Number(i.rate),
        })),
      },
    });
  } catch (error) {
    logError("search.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
