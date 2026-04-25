import { NextRequest, NextResponse } from "next/server";
import { serializeMeasurementUpload } from "@/lib/media";
import { prisma } from "@/lib/prisma";
import { resolveWriteSession } from "@/lib/api-tenant";
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

// GET /api/measurements/[id] - Get single measurement
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // [FIX] Use JWT-verified session instead of trusting proxy headers
  const sessionResolution = await resolveWriteSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, userId, role } = sessionResolution.session;

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

// PATCH /api/measurements/[id] - Update measurement status or party link
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // [FIX] Use JWT-verified session instead of trusting proxy headers
  const sessionResolution = await resolveWriteSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, userId, role } = sessionResolution.session;

  if (role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

// DELETE /api/measurements/[id] - Soft delete measurement
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // [FIX] Use JWT-verified session instead of trusting proxy headers
  const sessionResolution = await resolveWriteSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, role } = sessionResolution.session;

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
