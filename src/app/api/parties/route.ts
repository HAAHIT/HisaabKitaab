import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import type { Prisma, PartyType } from "@prisma/client";
import { resolveSession } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { isValidGstinFormat } from "@/lib/gst-helpers";
import { checkPartyQuota, incrementPartyCounter } from "@/lib/quota";

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
  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, role } = sessionResolution.session;

  if (role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const type = searchParams.get("type") || "";
  const sortBy = searchParams.get("sortBy") || "balance"; // "balance" or "name"
  const overdueFilter = searchParams.get("overdue") === "true";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(
    Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20),
    100
  );

  const where: Prisma.PartyWhereInput = { isActive: true, isDeleted: false, tenantId };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
    ];
  }

  if (type && type !== "ALL" && VALID_PARTY_TYPES.has(type as PartyType)) {
    where.type = type as PartyType;
  }

  // §5.3: Overdue filter — parties with negative balance and no payment in 30 days
  if (overdueFilter) {
    where.currentBalance = { lt: 0 };
    where.payments = {
      none: {
        isDeleted: false,
        date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    };
  }

  const orderBy: Prisma.PartyOrderByWithRelationInput =
    sortBy === "name"
      ? { name: "asc" }
      : { currentBalance: "asc" }; // Most negative (biggest debtors) first

  const [parties, total] = await Promise.all([
    prisma.party.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: { select: { payments: true } },
      },
    }),
    prisma.party.count({ where }),
  ]);

  return NextResponse.json({
    parties,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}

// POST /api/parties — Create a new party
export async function POST(request: NextRequest) {
  const rateLimitResponse = await checkRateLimit(request, "parties.create", 20);
  if (rateLimitResponse) return rateLimitResponse;

  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, userId, role } = sessionResolution.session;

  if (role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // [Phase 1 — Quota] FREE plan caps total active parties at 50.
  const partyQuota = await checkPartyQuota(tenantId);
  if (!partyQuota.allowed) {
    return NextResponse.json(
      {
        error: partyQuota.reason ?? "Party limit reached",
        code: "QUOTA_EXCEEDED",
        quota: { used: partyQuota.used, limit: partyQuota.limit, resource: "parties" },
      },
      { status: 402 }
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

    const normalizedGstin = normalizeOptionalString(gstin);
    if (normalizedGstin && !isValidGstinFormat(normalizedGstin)) {
      return NextResponse.json(
        { error: "Invalid GSTIN format. Must be a valid 15-character GSTIN." },
        { status: 400 }
      );
    }

    const party = await prisma.$transaction(async (tx) => {
      const p = await tx.party.create({
        data: {
          tenantId,
          name: normalizedName,
          type: normalizedType,
          phone: normalizeOptionalString(phone),
          email: normalizeOptionalString(email),
          address: normalizeOptionalString(address),
          gstin: normalizedGstin,
          openingBalance: normalizedOpeningBalance,
          currentBalance: normalizedOpeningBalance,
          isActive: true,
          isDeleted: false,
          createdBy: userId,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          entityType: "Party",
          entityId: p.id,
          userId,
          action: "CREATE",
        },
      });

      // [Phase 1 — Quota] Monthly analytics counter (live limit uses
      // count(*) from party table; this is for billing-period analytics).
      await incrementPartyCounter(tx, tenantId);

      return p;
    }, { isolationLevel: "RepeatableRead" });

    return NextResponse.json({ party }, { status: 201 });
  } catch (error) {
    logError("parties.create.error", { requestId: getRequestId(request), error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
