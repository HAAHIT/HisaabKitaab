import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import type { PartyType } from "@prisma/client";
import { resolveReadTenant, resolveWriteTenant } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";
import { checkRateLimit } from "@/lib/api-rate-limit";

const VALID_PARTY_TYPES = new Set<PartyType>(["CUSTOMER", "VENDOR"]);

/**
 * Type guard that verifies whether a string corresponds to an allowed PartyType.
 *
 * @param value - The input value to check; may be `undefined`.
 * @returns `true` if `value` is one of the allowed party types (`"CUSTOMER"` or `"VENDOR"`), `false` otherwise.
 */
function isPartyType(value: string | undefined): value is PartyType {
  return Boolean(value && VALID_PARTY_TYPES.has(value as PartyType));
}

/**
 * Normalizes an optional string by trimming whitespace and treating empty or non-string inputs as `null`.
 *
 * @param value - The value to normalize; non-string values are treated as absent.
 * @returns `null` if `value` is not a string or is empty after trimming; otherwise the trimmed string.
 */
function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Parse an input into an opening balance rounded to two decimal places.
 *
 * Accepts numbers, numeric strings, empty string, `null`, or `undefined`. Treats `""`, `null`, and `undefined` as `0`. Returns `null` for non-numeric or non-finite inputs.
 *
 * @param value - The raw value to parse into an opening balance.
 * @returns The parsed balance rounded to two decimal places, `0` for empty/null/undefined inputs, or `null` if the input is not a finite number.
 */
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

/**
 * Return the list of active, non-deleted parties for the resolved tenant, optionally filtered by search text and party type.
 *
 * @returns `{ parties: Party[] }` — an object with a `parties` array of party records for the tenant. Each party includes its stored fields and an `_count` object with `payments` indicating the number of payments; parties are ordered by name ascending.
 */
export async function GET(request: NextRequest) {
  const role = request.headers.get("x-user-role");

  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const tenantResolution = resolveReadTenant(request);
  if (!tenantResolution.ok) {
    return tenantResolution.response;
  }
  const tenantId = tenantResolution.tenantId;

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

/**
 * Create a new party scoped to the resolved write tenant after enforcing rate limits and authorization and validating input.
 *
 * Validates required fields (`name`, `type`, and a numeric `openingBalance`), normalizes optional string fields, ensures the caller is authorized, and persists the party with initial balances and metadata.
 *
 * @returns A JSON HTTP response: on success returns `{ party }` with status `201`; on validation or authorization failures returns an error object with an appropriate `4xx` status; on rate-limit or tenant-resolution failures returns the corresponding response; on unexpected errors returns `{ error: "Internal server error" }` with status `500`.
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await checkRateLimit(request, "parties.create", 20);
  if (rateLimitResponse) return rateLimitResponse;

  const role = request.headers.get("x-user-role");
  const userId = request.headers.get("x-user-id");

  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!userId) {
    return NextResponse.json({ error: "Missing user context" }, { status: 401 });
  }
  const tenantResolution = await resolveWriteTenant(request);
  if (!tenantResolution.ok) {
    return tenantResolution.response;
  }
  const tenantId = tenantResolution.tenantId;

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
