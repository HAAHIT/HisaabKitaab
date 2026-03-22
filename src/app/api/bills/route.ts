import { prisma } from "@/lib/prisma";
import { buildBillSnapshotFromParty } from "@/lib/accounting";
import { NextRequest, NextResponse } from "next/server";

const BILL_NUMBER_LOCK_KEY = 22032026;

// GET /api/bills — List bills with filtering
export async function GET(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const partyId = searchParams.get("partyId") || "";
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { isDeleted: false };

    if (search) {
      where.OR = [
        { billNumber: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { party: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (partyId) {
      where.partyId = partyId;
    }

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [bills, total] = await Promise.all([
      prisma.bill.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          billNumber: true,
          partyId: true,
          party: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          customerName: true,
          grandTotal: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.bill.count({ where }),
    ]);

    return NextResponse.json({
      bills,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    console.error("List bills error:", error);
    return NextResponse.json(
      { error: "Failed to load bills" },
      { status: 500 }
    );
  }
}

// POST /api/bills — Create a new bill
export async function POST(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  const userId = request.headers.get("x-user-id");

  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      templateId,
      partyId,
      customerName,
      customerPhone,
      customerAddress,
      gstin,
      rows,
      notes,
      terms,
      taxPercent,
      subtotal,
      taxAmount,
      grandTotal,
      status,
    } = body;

    if (!templateId || !partyId || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "Template, party, and at least one row are required" },
        { status: 400 }
      );
    }

    const party = await prisma.party.findFirst({
      where: {
        id: partyId,
        isDeleted: false,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        gstin: true,
      },
    });

    if (!party) {
      return NextResponse.json({ error: "Party not found" }, { status: 404 });
    }

    const settings = await prisma.companySettings.findUnique({
      where: { id: "default" },
    });
    const prefix = settings?.billPrefix || "BILL";
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const snapshot = buildBillSnapshotFromParty(party, {
      customerName,
      customerPhone,
      customerAddress,
      gstin,
    });

    const bill = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BILL_NUMBER_LOCK_KEY})`;

      const existingCount = await tx.bill.count({
        where: {
          createdAt: {
            gte: monthStart,
            lt: nextMonthStart,
          },
        },
      });
      const billNumber = `${prefix}-${yearMonth}-${String(existingCount + 1).padStart(3, "0")}`;

      return tx.bill.create({
        data: {
          billNumber,
          templateId,
          partyId: party.id,
          ...snapshot,
          rows,
          notes: notes || null,
          terms: terms || null,
          subtotal: subtotal || 0,
          taxPercent: taxPercent ?? (settings?.defaultTaxPercent || 0),
          taxAmount: taxAmount || 0,
          grandTotal: grandTotal || 0,
          status: status || "DRAFT",
          createdBy: userId!,
        },
      });
    });

    return NextResponse.json({ bill }, { status: 201 });
  } catch (error) {
    console.error("Create bill error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
