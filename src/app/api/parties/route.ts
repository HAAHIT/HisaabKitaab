import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import type { PartyType } from "@prisma/client";
import {
  resolveTenantIdFromRequest,
  TENANT_CONTEXT_MISSING_MESSAGE,
} from "@/lib/tenant";
import { resolveVerifiedTenantId } from "@/lib/session-server";
import { logError, getRequestId } from "@/lib/observability";

const VALID_PARTY_TYPES = new Set<PartyType>(["CUSTOMER", "VENDOR"]);

function isPartyType(value: string | undefined): value is PartyType {
  return Boolean(value && VALID_PARTY_TYPES.has(value as PartyType));
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseOpeningBalance(value: unknown) {
  if (value === undefined || value === null || value === "") return 0;
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value)
        : Number.NaN;
  if (!Number.isFinite(numericValue)) return null;
  return Math.round(numericValue * 100) / 100;
}

// GET /api/parties — List all parties with balance info
export async function GET(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  const tenantId = resolveTenantIdFromRequest(request);
  
  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: TENANT_CONTEXT_MISSING_MESSAGE },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const type = searchParams.get("type") || "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { isActive: true, isDeleted: false, tenantId };

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
  const tenantId = await resolveVerifiedTenantId(request);

  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!userId) {
    return NextResponse.json({ error: "Missing user context" }, { status: 401 });
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: TENANT_CONTEXT_MISSING_MESSAGE },
      { status: 500 }
    );
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

    if (!isPartyType(normalizedType)) {
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
        tenantId,
        name: normalizedName,
        type: normalizedType,
        phone: normalizeOptionalString(phone),
        email: normalizeOptionalString(email),
        address: normalizeOptionalString(address),
        gstin: normalizeOptionalString(gstin),
        openingBalance: normalizedOpeningBalance,
        currentBalance: normalizedOpeningBalance,
        isActive: true,
        isDeleted: false,
        createdBy: userId,
      },
    });

    return NextResponse.json({ party }, { status: 201 });
  } catch (error) {
    logError("parties.create.error", { requestId: getRequestId(request), error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
