import { prisma } from "@/lib/prisma";
import {
  buildBillSnapshotFromParty,
  getBillBalanceDeltaForTransition,
} from "@/lib/accounting";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_BILL_PATCH_KEYS = new Set([
  "templateId",
  "partyId",
  "customerName",
  "customerPhone",
  "customerAddress",
  "gstin",
  "rows",
  "notes",
  "terms",
  "taxPercent",
  "subtotal",
  "taxAmount",
  "grandTotal",
  "status",
]);

const ALLOWED_BILL_PATCH_STATUSES = new Set(["DRAFT", "FINAL"]);

function hasOwn(body: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function normalizeOptionalString(value: unknown) {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseOptionalNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return value;
}

async function findVisibleBill(id: string) {
  return prisma.bill.findFirst({
    where: {
      id,
      isDeleted: false,
    },
    include: {
      template: true,
      party: {
        select: {
          id: true,
          name: true,
          type: true,
          phone: true,
          address: true,
          gstin: true,
        },
      },
      creator: { select: { name: true } },
    },
  });
}

// GET /api/bills/[id] - Get a single bill with template
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = request.headers.get("x-user-role");
  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const bill = await findVisibleBill(id);

  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  return NextResponse.json({ bill });
}

// PATCH /api/bills/[id] - Update a draft bill
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = request.headers.get("x-user-role");
  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const unexpectedKeys = Object.keys(body).filter(
      (key) => !ALLOWED_BILL_PATCH_KEYS.has(key)
    );

    if (unexpectedKeys.length > 0) {
      return NextResponse.json(
        { error: `Unexpected bill fields: ${unexpectedKeys.join(", ")}` },
        { status: 400 }
      );
    }

    const existing = await prisma.bill.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      select: {
        id: true,
        status: true,
        grandTotal: true,
        templateId: true,
        partyId: true,
        customerName: true,
        customerPhone: true,
        customerAddress: true,
        gstin: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }

    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only draft bills can be edited" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (hasOwn(body, "templateId")) {
      if (typeof body.templateId !== "string" || !body.templateId.trim()) {
        return NextResponse.json(
          { error: "Template is required" },
          { status: 400 }
        );
      }

      const template = await prisma.billTemplate.findFirst({
        where: {
          id: body.templateId.trim(),
          isDeleted: false,
        },
        select: { id: true },
      });

      if (!template) {
        return NextResponse.json(
          { error: "Template not found" },
          { status: 404 }
        );
      }

      updateData.templateId = template.id;
    }

    if (hasOwn(body, "rows")) {
      if (!Array.isArray(body.rows) || body.rows.length === 0) {
        return NextResponse.json(
          { error: "At least one row is required" },
          { status: 400 }
        );
      }

      updateData.rows = body.rows;
    }

    for (const field of ["notes", "terms"] as const) {
      if (!hasOwn(body, field)) {
        continue;
      }

      const value = normalizeOptionalString(body[field]);
      if (value === undefined) {
        return NextResponse.json(
          { error: `${field} must be a string` },
          { status: 400 }
        );
      }

      updateData[field] = value;
    }

    for (const field of ["taxPercent", "subtotal", "taxAmount", "grandTotal"] as const) {
      if (!hasOwn(body, field)) {
        continue;
      }

      const value = parseOptionalNumber(body[field]);
      if (value === undefined || value < 0) {
        return NextResponse.json(
          { error: `${field} must be a non-negative number` },
          { status: 400 }
        );
      }

      updateData[field] = value;
    }

    if (hasOwn(body, "status")) {
      if (
        typeof body.status !== "string" ||
        !ALLOWED_BILL_PATCH_STATUSES.has(body.status)
      ) {
        return NextResponse.json(
          { error: "Invalid bill status" },
          { status: 400 }
        );
      }

      updateData.status = body.status;
    }

    let nextPartyId = existing.partyId;
    if (hasOwn(body, "partyId")) {
      if (body.partyId === "" || body.partyId === null) {
        nextPartyId = null;
      } else if (typeof body.partyId === "string" && body.partyId.trim()) {
        nextPartyId = body.partyId.trim();
      } else {
        return NextResponse.json(
          { error: "partyId must be a string or null" },
          { status: 400 }
        );
      }
    }

    const customerName = hasOwn(body, "customerName")
      ? normalizeOptionalString(body.customerName)
      : undefined;
    const customerPhone = hasOwn(body, "customerPhone")
      ? normalizeOptionalString(body.customerPhone)
      : undefined;
    const customerAddress = hasOwn(body, "customerAddress")
      ? normalizeOptionalString(body.customerAddress)
      : undefined;
    const gstin = hasOwn(body, "gstin")
      ? normalizeOptionalString(body.gstin)
      : undefined;

    if (
      [customerName, customerPhone, customerAddress, gstin].some(
        (value) => value === undefined
      )
    ) {
      return NextResponse.json(
        { error: "Customer snapshot fields must be strings or null" },
        { status: 400 }
      );
    }

    if (nextPartyId) {
      const party = await prisma.party.findFirst({
        where: {
          id: nextPartyId,
          isDeleted: false,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          phone: true,
          address: true,
          gstin: true,
        },
      });

      if (!party) {
        return NextResponse.json({ error: "Party not found" }, { status: 404 });
      }

      const snapshot = buildBillSnapshotFromParty(party, {
        customerName,
        customerPhone,
        customerAddress,
        gstin,
      });

      updateData.partyId = party.id;
      updateData.customerName = snapshot.customerName;
      updateData.customerPhone = snapshot.customerPhone;
      updateData.customerAddress = snapshot.customerAddress;
      updateData.gstin = snapshot.gstin;
    } else if (
      hasOwn(body, "partyId") ||
      hasOwn(body, "customerName") ||
      hasOwn(body, "customerPhone") ||
      hasOwn(body, "customerAddress") ||
      hasOwn(body, "gstin")
    ) {
      if (hasOwn(body, "partyId")) {
        updateData.partyId = null;
      }

      if (hasOwn(body, "customerName")) {
        updateData.customerName = customerName ?? existing.customerName;
      }
      if (hasOwn(body, "customerPhone")) {
        updateData.customerPhone = customerPhone ?? existing.customerPhone;
      }
      if (hasOwn(body, "customerAddress")) {
        updateData.customerAddress =
          customerAddress ?? existing.customerAddress;
      }
      if (hasOwn(body, "gstin")) {
        updateData.gstin = gstin ?? existing.gstin;
      }
    }

    const finalStatus =
      ((updateData.status as "DRAFT" | "FINAL" | undefined) ?? existing.status);
    const finalPartyId =
      (updateData.partyId as string | null | undefined) ?? existing.partyId;

    if (finalStatus === "FINAL" && !finalPartyId) {
      return NextResponse.json(
        { error: "Final bills must be linked to a party" },
        { status: 400 }
      );
    }

    const nextGrandTotal =
      (updateData.grandTotal as number | undefined) ?? existing.grandTotal;

    const bill = await prisma.$transaction(async (tx) => {
      const updatedBill = await tx.bill.update({
        where: { id },
        data: updateData,
      });

      if (!finalPartyId) {
        return updatedBill;
      }

      const party = await tx.party.findFirst({
        where: {
          id: finalPartyId,
          isDeleted: false,
          isActive: true,
        },
        select: {
          id: true,
          type: true,
        },
      });

      if (!party) {
        throw new Error("Party not found");
      }

      const balanceChange = getBillBalanceDeltaForTransition({
        partyType: party.type,
        previousStatus: existing.status,
        previousAmount: existing.grandTotal,
        nextStatus: finalStatus,
        nextAmount: nextGrandTotal,
      });

      if (balanceChange !== 0) {
        await tx.party.update({
          where: { id: party.id },
          data: {
            currentBalance: { increment: balanceChange },
          },
        });
      }

      return updatedBill;
    });

    return NextResponse.json({ bill });
  } catch (error) {
    console.error("Update bill error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/bills/[id] - Cancel a bill (Admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = request.headers.get("x-user-role");
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const existing = await prisma.bill.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      select: {
        id: true,
        status: true,
        grandTotal: true,
        partyId: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.bill.update({
        where: { id },
        data: { status: "CANCELLED" },
      });

      if (!existing.partyId) {
        return;
      }

      const party = await tx.party.findFirst({
        where: {
          id: existing.partyId,
          isDeleted: false,
        },
        select: {
          id: true,
          type: true,
        },
      });

      if (!party) {
        return;
      }

      const balanceChange = getBillBalanceDeltaForTransition({
        partyType: party.type,
        previousStatus: existing.status,
        previousAmount: existing.grandTotal,
        nextStatus: "CANCELLED",
        nextAmount: existing.grandTotal,
      });

      if (balanceChange !== 0) {
        await tx.party.update({
          where: { id: party.id },
          data: {
            currentBalance: { increment: balanceChange },
          },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cancel bill error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
