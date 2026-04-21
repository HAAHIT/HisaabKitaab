import { prisma } from "@/lib/prisma";
import { resolveReadTenant, resolveWriteTenant } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";
import { NextRequest, NextResponse } from "next/server";
import type { PartyType } from "@prisma/client";

const VALID_PARTY_TYPES = new Set<PartyType>(["CUSTOMER", "VENDOR"]);

function isPartyType(value: string | undefined): value is PartyType {
  return Boolean(value && VALID_PARTY_TYPES.has(value as PartyType));
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

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

// GET /api/parties/[id] - Get single party with payment history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = request.headers.get("x-user-role");

  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const tenantResolution = await resolveReadTenant(request);
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

// PATCH /api/parties/[id] - Update party
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

    // TODO: [CRITICAL] - MCA GSR 247(E) audit trail for party UPDATE
    // [MCA GSR 247(E)] Append-only edit log — mandatory since April 1 2023.
    // Captures field-level changes for statutory audit compliance.
    const changedFields = Object.keys(body);
    if (changedFields.length > 0) {
      await prisma.auditLog.create({
        data: {
          tenantId,
          entityType: "Party",
          entityId: party.id,
          userId: request.headers.get("x-user-id") || null,
          action: "UPDATE",
          fieldName: changedFields.join(","),
          oldValue: JSON.stringify(
            Object.fromEntries(
              changedFields.map((f) => [
                f,
                (existingParty as Record<string, unknown>)[f] ?? null,
              ])
            )
          ),
          newValue: JSON.stringify(
            Object.fromEntries(
              changedFields.map((f) => [
                f,
                (party as Record<string, unknown>)[f] ?? null,
              ])
            )
          ),
        },
      });
    }

    return NextResponse.json({ party });
  } catch (error) {
    logError("parties.update.error", { requestId: getRequestId(request), error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/parties/[id] - Soft delete
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

    // TODO: [CRITICAL] - MCA GSR 247(E) audit trail for party DELETE
    // [MCA GSR 247(E)] Append-only edit log — mandatory since April 1 2023.
    // Records the soft-deletion actor for statutory audit compliance.
    await prisma.auditLog.create({
      data: {
        tenantId,
        entityType: "Party",
        entityId: existingParty.id,
        userId: request.headers.get("x-user-id") || null,
        action: "DELETE",
        fieldName: "isDeleted",
        oldValue: JSON.stringify(false),
        newValue: JSON.stringify(true),
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
