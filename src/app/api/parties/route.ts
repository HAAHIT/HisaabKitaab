import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const VALID_PARTY_TYPES = new Set(["CUSTOMER", "VENDOR"]);

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseOpeningBalance(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value)
        : Number.NaN;

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return Math.round(numericValue * 100) / 100;
}

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
    const normalizedName = normalizeOptionalString(name);
    const normalizedType =
      typeof type === "string" ? type.trim().toUpperCase() : undefined;
    const normalizedOpeningBalance = parseOpeningBalance(openingBalance);

    if (!normalizedName || !normalizedType) {
      return NextResponse.json(
        { error: "Name and type are required" },
        { status: 400 }
      );
    }

    if (!VALID_PARTY_TYPES.has(normalizedType)) {
      return NextResponse.json(
        { error: "Invalid party type" },
        { status: 400 }
      );
    }

    if (normalizedOpeningBalance === null) {
      return NextResponse.json(
        { error: "Opening balance must be a valid number" },
        { status: 400 }
      );
    }

    const party = await prisma.party.create({
      data: {
        name: normalizedName,
        phone: normalizeOptionalString(phone),
        email: normalizeOptionalString(email),
        address: normalizeOptionalString(address),
        gstin: normalizeOptionalString(gstin),
        type: normalizedType,
        openingBalance: normalizedOpeningBalance,
        currentBalance: normalizedOpeningBalance,
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
