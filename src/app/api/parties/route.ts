import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/parties — List all parties with balance info
export async function GET(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const type = searchParams.get("type") || "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { isActive: true, isDeleted: false };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
    ];
  }

  if (type && type !== "ALL") {
    where.type = type;
  }

  const parties = await prisma.party.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      _count: { select: { payments: true } },
    },
  });

  return NextResponse.json({ parties });
}

// POST /api/parties — Create a new party
export async function POST(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  const userId = request.headers.get("x-user-id");

  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, phone, email, address, gstin, type, openingBalance } = body;

    if (!name || !type) {
      return NextResponse.json(
        { error: "Name and type are required" },
        { status: 400 }
      );
    }

    const party = await prisma.party.create({
      data: {
        name,
        phone: phone || null,
        email: email || null,
        address: address || null,
        gstin: gstin || null,
        type,
        openingBalance: openingBalance || 0,
        currentBalance: openingBalance || 0,
        createdBy: userId!,
      },
    });

    return NextResponse.json({ party }, { status: 201 });
  } catch (error) {
    console.error("Create party error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
