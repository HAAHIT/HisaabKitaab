import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/bills — List bills with filtering
export async function GET(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (search) {
    where.OR = [
      { billNumber: { contains: search, mode: "insensitive" } },
      { customerName: { contains: search, mode: "insensitive" } },
    ];
  }

  if (status && status !== "ALL") {
    where.status = status;
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
    totalPages: Math.ceil(total / limit),
  });
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

    if (!templateId || !customerName || !rows) {
      return NextResponse.json(
        { error: "Template, customer name, and rows are required" },
        { status: 400 }
      );
    }

    // Generate bill number
    const settings = await prisma.companySettings.findUnique({
      where: { id: "default" },
    });
    const prefix = settings?.billPrefix || "BILL";
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Count existing bills this month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const existingCount = await prisma.bill.count({
      where: {
        createdAt: { gte: monthStart, lte: monthEnd },
      },
    });
    const billNumber = `${prefix}-${yearMonth}-${String(existingCount + 1).padStart(3, "0")}`;

    const bill = await prisma.bill.create({
      data: {
        billNumber,
        templateId,
        customerName,
        customerPhone: customerPhone || null,
        customerAddress: customerAddress || null,
        gstin: gstin || null,
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

    return NextResponse.json({ bill }, { status: 201 });
  } catch (error) {
    console.error("Create bill error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
