import { prisma } from "@/lib/prisma";
import { resolveReadTenant, resolveWriteTenant } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";
import { NextRequest, NextResponse } from "next/server";
import type { PartyType } from "@prisma/client";

const VALID_PARTY_TYPES = new Set<PartyType>(["CUSTOMER", "VENDOR"]);

/**
 * Determines whether a string value is a valid party type.
 *
 * @param value - Candidate party type string to validate
 * @returns `true` if `value` is one of the recognized `PartyType` values (narrows `value` to `PartyType`), `false` otherwise.
 */
function isPartyType(value: string | undefined): value is PartyType {
  return Boolean(value && VALID_PARTY_TYPES.has(value as PartyType));
}

/**
 * Normalize an optional string by trimming whitespace and converting non-strings or empty strings to `null`.
 *
 * @param value - The value to normalize; may be any type
 * @returns The trimmed string if `value` is a non-empty string after trimming, `null` otherwise
 */
function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Retrieves a non-deleted party for a tenant, including its most recent non-deleted payments.
 *
 * @param id - The party's UUID
 * @param tenantId - The tenant's UUID to scope the lookup
 * @returns The party record with up to 20 non-deleted `payments` ordered by `date` descending, or `null` if not found
 */
async function findVisibleParty(id: string, tenantId: string) {
  return prisma.party.findFirst({
    where: {
      id,
      tenantId,
      isDeleted: false,
    },
    include: {
      payments: {
        where: { isDeleted: false },
        orderBy: { date: "desc" },
        take: 20,
      },
    },
  });
}

/**
 * Handle GET /api/parties/[id]: fetch a visible party along with its recent payment history for the resolved tenant.
 *
 * The request must include an `x-user-role` header and will be rejected with 403 if the header is missing or equals `"CUSTOMER"`.
 *
 * @param request - Incoming request; must include `x-user-role` to authorize access.
 * @param params - Object whose awaited `id` property identifies the party to fetch.
 * @returns A NextResponse containing `{ party }` on success; returns a 403 response for access denial, the tenant-resolution response if tenant validation fails, or a 404 response if the party is not found.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = request.headers.get("x-user-role");

  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const tenantResolution = resolveReadTenant(request);
  if (!tenantResolution.ok) {
    return tenantResolution.response;
  }
  const tenantId = tenantResolution.tenantId;

  const { id } = await params;
  const party = await findVisibleParty(id, tenantId);

  if (!party) {
    return NextResponse.json({ error: "Party not found" }, { status: 404 });
  }

  return NextResponse.json({ party });
}

/**
 * Handles PATCH requests to update an existing party identified by ID.
 *
 * Validates caller role and tenant, enforces allowed update fields, requires a non-empty `name`,
 * validates `type`, prevents changing `type` if the party has related bills, payments, or measurements,
 * applies normalized optional fields, and returns the updated party on success.
 *
 * Possible responses:
 * - 200: `{ party: ... }` — the updated party object
 * - 400: `{ error: string }` — validation errors (unexpected field, missing name, invalid type, or disallowed type change)
 * - 403: `{ error: "Forbidden" }` — missing or insufficient user role
 * - 404: `{ error: "Party not found" }` — no visible party for given id and tenant
 * - 500: `{ error: "Internal server error" }` — unexpected server error
 *
 * @returns `{ party: object }` on success; otherwise `{ error: string }` describing the failure
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = request.headers.get("x-user-role");

  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const tenantResolution = await resolveWriteTenant(request);
  if (!tenantResolution.ok) {
    return tenantResolution.response;
  }
  const tenantId = tenantResolution.tenantId;

  try {
    const { id } = await params;
    const body = await request.json();
    const existingParty = await findVisibleParty(id, tenantId);

    if (!existingParty) {
      return NextResponse.json({ error: "Party not found" }, { status: 404 });
    }

    const allowedKeys = new Set([
      "name",
      "phone",
      "email",
      "address",
      "gstin",
      "type",
    ]);
    const unexpectedKey = Object.keys(body).find((key) => !allowedKeys.has(key));

    if (unexpectedKey) {
      return NextResponse.json(
        { error: `Unexpected field: ${unexpectedKey}` },
        { status: 400 }
      );
    }

    const nextName = normalizeOptionalString(body.name);
    const nextType =
      typeof body.type === "string" ? body.type.trim().toUpperCase() : undefined;

    if (!nextName) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (!isPartyType(nextType)) {
      return NextResponse.json({ error: "Invalid party type" }, { status: 400 });
    }

    if (nextType !== existingParty.type) {
      const relationCounts = await prisma.party.findFirst({
        where: {
          id,
          tenantId,
        },
        select: {
          _count: {
            select: {
              bills: true,
              payments: true,
              measurements: true,
            },
          },
        },
      });

      const hasLinkedRecords =
        (relationCounts?._count.bills || 0) > 0 ||
        (relationCounts?._count.payments || 0) > 0 ||
        (relationCounts?._count.measurements || 0) > 0;

      if (hasLinkedRecords) {
        return NextResponse.json(
          {
            error:
              "Cannot change party type after bills, payments, or measurements exist",
          },
          { status: 400 }
        );
      }
    }

    const party = await prisma.party.update({
      where: { id },
      data: {
        name: nextName,
        phone: normalizeOptionalString(body.phone),
        email: normalizeOptionalString(body.email),
        address: normalizeOptionalString(body.address),
        gstin: normalizeOptionalString(body.gstin),
        type: nextType,
      },
    });

    return NextResponse.json({ party });
  } catch (error) {
    logError("parties.update.error", { requestId: getRequestId(request), error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Soft-deletes the party identified by the `id` route parameter for the resolved tenant.
 *
 * Requires the request to have an `x-user-role` header equal to `"ADMIN"`. Resolves the write tenant before proceeding and returns appropriate HTTP error responses when authorization fails, the party does not exist, or an internal error occurs.
 *
 * @param params - Route parameters; must include `id`, the ID of the party to delete.
 * @returns A JSON response: `{ success: true }` on successful soft delete; otherwise an `{ error: string }` with status `403` (forbidden), `404` (not found), or `500` (internal server error).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = request.headers.get("x-user-role");

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const tenantResolution = await resolveWriteTenant(request);
  if (!tenantResolution.ok) {
    return tenantResolution.response;
  }
  const tenantId = tenantResolution.tenantId;

  try {
    const { id } = await params;
    const existingParty = await findVisibleParty(id, tenantId);

    if (!existingParty) {
      return NextResponse.json({ error: "Party not found" }, { status: 404 });
    }

    await prisma.party.update({
      where: { id },
      data: {
        isActive: false,
        isDeleted: true,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError("parties.delete.error", { requestId: getRequestId(request), error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
