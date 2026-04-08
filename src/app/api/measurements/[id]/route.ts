import { NextRequest, NextResponse } from "next/server";
import { serializeMeasurementUpload } from "@/lib/media";
import { prisma } from "@/lib/prisma";
import { resolveReadTenant, resolveWriteTenant } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";

export const runtime = "nodejs";

const measurementInclude = {
  customer: { select: { name: true, phone: true, email: true } },
  party: { select: { id: true, name: true, type: true } },
  photoAssets: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      sortOrder: true,
      asset: {
        select: { id: true },
      },
    },
  },
};

/**
 * Fetches a non-deleted measurement upload by its id within the given tenant.
 *
 * @param id - The measurement upload's id
 * @param tenantId - Tenant id to scope the lookup
 * @returns The matched measurement upload with related entities included, or `null` if none is found
 */
async function findVisibleMeasurement(id: string, tenantId: string) {
  return prisma.measurementUpload.findFirst({
    where: {
      id,
      tenantId,
      isDeleted: false,
    },
    include: measurementInclude,
  });
}

/**
 * Handle GET /api/measurements/[id] and return a single serialized measurement scoped to the resolved tenant.
 *
 * @param request - The incoming Next.js request; must include `x-user-role` and `x-user-id` headers for auth.
 * @param params - Route parameters promise resolving to an object with `id` (measurement id).
 * @returns A NextResponse containing `{ measurement: ... }` with the serialized measurement on success;
 *          returns 401 if authentication headers are missing, 403 if a CUSTOMER is not authorized for the measurement,
 *          404 if the measurement does not exist, or the tenant-resolution response if tenant resolution fails.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = request.headers.get("x-user-role");
  const userId = request.headers.get("x-user-id");

  if (!role || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tenantResolution = resolveReadTenant(request);
  if (!tenantResolution.ok) {
    return tenantResolution.response;
  }
  const tenantId = tenantResolution.tenantId;

  const { id } = await params;
  const measurement = await findVisibleMeasurement(id, tenantId);

  if (!measurement) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (role === "CUSTOMER" && measurement.customerId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    measurement: serializeMeasurementUpload(measurement),
  });
}

/**
 * Update a measurement's status, review notes, reviewer, or linked customer party.
 *
 * Accepts an optional `status` string, optional `reviewNotes` (string or null), and optional
 * `partyId` (string or null). Verifies caller role and tenant write access, validates the
 * target measurement and (when provided) the target customer party, then updates the
 * measurement and returns the serialized result.
 *
 * @returns The updated serialized measurement as `{ measurement: /* serialized measurement */ }` on success; on failure returns a JSON error object with an appropriate HTTP status (403, 404, or 500).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = request.headers.get("x-user-role");
  const userId = request.headers.get("x-user-id");

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
    const { status, reviewNotes, partyId } = body;
    const existingMeasurement = await findVisibleMeasurement(id, tenantId);

    if (!existingMeasurement) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {
      reviewedBy: userId,
    };

    if (typeof status === "string" && status) {
      data.status = status;
    }

    if (reviewNotes !== undefined) {
      data.reviewNotes =
        typeof reviewNotes === "string" && reviewNotes.trim()
          ? reviewNotes.trim()
          : null;
    }

    if (partyId !== undefined) {
      if (partyId === null) {
        data.partyId = null;
      } else {
        const party = await prisma.party.findFirst({
          where: {
            id: partyId,
            tenantId,
            type: "CUSTOMER",
            isDeleted: false,
            isActive: true,
          },
          select: { id: true },
        });

        if (!party) {
          return NextResponse.json({ error: "Party not found" }, { status: 404 });
        }

        data.partyId = party.id;
      }
    }

    const measurement = await prisma.measurementUpload.update({
      where: { id },
      data,
      include: measurementInclude,
    });

    return NextResponse.json({
      measurement: serializeMeasurementUpload(measurement),
    });
  } catch (error) {
    logError("measurements.update.error", { requestId: getRequestId(request), error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Soft-deletes a measurement by id within the resolved tenant.
 *
 * Attempts to resolve a write tenant and, if authorized as an ADMIN, marks the specified
 * measurement's `isDeleted` flag as `true`. Keeps related assets attached for audit/recovery.
 *
 * @param params - Route parameters (a promise resolving to an object with the `id` of the measurement to delete)
 * @returns A JSON response: `{ success: true }` on success; otherwise a JSON error object with an appropriate HTTP status (403 if forbidden, 404 if not found, 500 on server error)
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
    const measurement = await prisma.measurementUpload.findFirst({
      where: {
        id,
        tenantId,
        isDeleted: false,
      },
    });

    if (!measurement) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Keep assets attached to tombstoned measurements so audit and recovery remain possible.
    await prisma.measurementUpload.update({
      where: { id },
      data: { isDeleted: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError("measurements.delete.error", { requestId: getRequestId(request), error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
