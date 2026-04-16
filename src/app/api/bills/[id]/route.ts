import { prisma } from "@/lib/prisma";
import { GST_STATE_CODE_SET } from "@/lib/gst-states";
import {
  buildBillSnapshotFromParty,
  getBillBalanceDeltaForTransition,
} from "@/lib/accounting";
import {
  journalForCancelledSalesBill,
  journalForSalesBill,
} from "@/lib/journal";
import { NextRequest, NextResponse } from "next/server";
import { resolveReadTenant, resolveWriteTenant } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";

// Derive Prisma types from the client instance to avoid the
// @prisma/client → .prisma/client re-export resolution failure
// under moduleResolution:"bundler" in Prisma v7.
type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type BillUpdateData = Parameters<typeof prisma.bill.update>[0]["data"];

const ALLOWED_BILL_PATCH_KEYS = new Set([
  "templateId",
  "partyId",
  "customerName",
  "customerPhone",
  "customerAddress",
  "gstin",
  "placeOfSupply",
  "rows",
  "notes",
  "terms",
  "taxPercent",
  "subtotal",
  "taxAmount",
  "grandTotal",
  "status",
  "isInterState",
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
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

async function findVisibleBill(id: string, tenantId: string) {
  return prisma.bill.findFirst({
    where: {
      id,
      tenantId,
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
  const tenantResolution = resolveReadTenant(request);
  if (!tenantResolution.ok) {
    return tenantResolution.response;
  }
  const tenantId = tenantResolution.tenantId;

  const { id } = await params;
  const bill = await findVisibleBill(id, tenantId);

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

    const hasIsInterState = hasOwn(body, "isInterState");
    if (hasIsInterState && typeof body.isInterState !== "boolean") {
      return NextResponse.json(
        { error: "isInterState must be a boolean" },
        { status: 400 }
      );
    }

    const hasPlaceOfSupply = hasOwn(body, "placeOfSupply");
    if (hasPlaceOfSupply) {
      const pos = body.placeOfSupply;
      if (pos !== null && pos !== undefined) {
        if (typeof pos !== "string" || !GST_STATE_CODE_SET.has(pos)) {
          return NextResponse.json(
            {
              error:
                "Invalid place of supply. Must be a 2-digit GST state code (e.g. '27' for Maharashtra).",
            },
            { status: 400 }
          );
        }
      }
    }

    const existing = await prisma.bill.findFirst({
      where: {
        id,
        tenantId,
        isDeleted: false,
      },
      select: {
        id: true,
        status: true,
        billNumber: true,
        subtotal: true,
        taxPercent: true,
        taxAmount: true,
        grandTotal: true,
        isInterState: true,
        templateId: true,
        partyId: true,
        customerName: true,
        customerPhone: true,
        customerAddress: true,
        gstin: true,
        createdBy: true,
        rows: true,        // needed for HSN validation gate
        placeOfSupply: true, // needed for placeOfSupply validation gate
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }

    const isInterState = hasIsInterState
      ? body.isInterState === true
      : existing.isInterState;

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
          tenantId,
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
      if (!hasOwn(body, field) || body[field] === null) {
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

    if (hasIsInterState) {
      updateData.isInterState = isInterState;
    }

    if (hasPlaceOfSupply) {
      const pos = body.placeOfSupply;
      updateData.placeOfSupply =
        typeof pos === "string" && pos ? pos : null;
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
          tenantId,
          isDeleted: false,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          phone: true,
          address: true,
          gstin: true,
          type: true,
        },
      });

      if (!party) {
        return NextResponse.json({ error: "Party not found" }, { status: 404 });
      }

      const snapshot = buildBillSnapshotFromParty(party, {
        customerName: customerName as string | null | undefined,
        customerPhone: customerPhone as string | null | undefined,
        customerAddress: customerAddress as string | null | undefined,
        gstin: gstin as string | null | undefined,
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
      (updateData.grandTotal as number | undefined) ?? existing.grandTotal.toNumber();
    const nextSubtotal =
      (updateData.subtotal as number | undefined) ?? existing.subtotal.toNumber();
    const nextTaxAmount =
      (updateData.taxAmount as number | undefined) ?? existing.taxAmount.toNumber();

    if (finalStatus === "FINAL" && nextGrandTotal <= 0) {
      return NextResponse.json(
        { error: "Final bills must have a positive total" },
        { status: 400 }
      );
    }

    const nextTaxPercent =
      (updateData.taxPercent as number | undefined) ?? existing.taxPercent?.toNumber() ?? 0;

    // [P0] Block FINAL transition if placeOfSupply is missing.
    // Required for ALL final bills under GSTR-1 — not just B2B.
    const finalPlaceOfSupply = hasPlaceOfSupply
      ? (updateData.placeOfSupply as string | null | undefined)
      : existing.placeOfSupply;

    if (finalStatus === "FINAL" && !finalPlaceOfSupply) {
      return NextResponse.json(
        {
          error:
            "Place of Supply is required to finalise a bill (mandatory for GSTR-1 compliance).",
        },
        { status: 400 }
      );
    }

    // [P0] Block FINAL transition if tax > 0 but no HSN code present in rows.
    // Without HSN, GSTR-1 Table 12 (HSN-wise summary) will be incomplete.
    if (finalStatus === "FINAL" && nextTaxPercent > 0) {
      const rowsToCheck = (updateData.rows ?? existing.rows) as unknown[];
      const hasHsn =
        Array.isArray(rowsToCheck) &&
        rowsToCheck.some(
          (row) =>
            row &&
            typeof row === "object" &&
            typeof (row as Record<string, unknown>)["_hsnCode"] === "string" &&
            ((row as Record<string, unknown>)["_hsnCode"] as string).trim() !== ""
        );
      if (!hasHsn) {
        return NextResponse.json(
          {
            error:
              "At least one HSN/SAC code is required when tax is applied (mandatory for GSTR-1 Table 12).",
          },
          { status: 400 }
        );
      }
    }

    const bill = await prisma.$transaction(async (tx: PrismaTx) => {
      const updatedBill = await tx.bill.update({
        where: { id },
        data: updateData as BillUpdateData,
      });

      if (!finalPartyId) {
        return updatedBill;
      }

      const party = await tx.party.findFirst({
        where: {
          id: finalPartyId,
          tenantId,
          isDeleted: false,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          type: true,
        },
      });

      if (!party) {
        throw new Error("Party not found");
      }

      const balanceChange = getBillBalanceDeltaForTransition({
        partyType: party.type,
        previousStatus: existing.status,
        previousAmount: existing.grandTotal.toNumber(),
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

      if (existing.status !== "FINAL" && finalStatus === "FINAL") {
        await journalForSalesBill(tx, tenantId, {
          id: updatedBill.id,
          billNumber: updatedBill.billNumber,
          partyId: party.id,
          partyName: party.name,
          subtotal: nextSubtotal,
          taxAmount: nextTaxAmount,
          grandTotal: nextGrandTotal,
          createdBy: userId || updatedBill.createdBy,
          entryDate: updatedBill.updatedAt,
          isInterState,
        });
      }

      return updatedBill;
    });

    return NextResponse.json({ bill });
  } catch (error) {
    logError("bills.update.error", { requestId: getRequestId(request), error });
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
  const userId = request.headers.get("x-user-id");

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
    const existing = await prisma.bill.findFirst({
      where: {
        id,
        tenantId,
        isDeleted: false,
      },
      select: {
        id: true,
        status: true,
        billNumber: true,
        subtotal: true,
        taxAmount: true,
        grandTotal: true,
        isInterState: true,
        partyId: true,
        createdBy: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx: PrismaTx) => {
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
          tenantId,
          isDeleted: false,
        },
        select: {
          id: true,
          name: true,
          type: true,
        },
      });

      if (!party) {
        return;
      }

      const balanceChange = getBillBalanceDeltaForTransition({
        partyType: party.type,
        previousStatus: existing.status,
        previousAmount: existing.grandTotal.toNumber(),
        nextStatus: "CANCELLED",
        nextAmount: existing.grandTotal.toNumber(),
      });

      if (balanceChange !== 0) {
        await tx.party.update({
          where: { id: party.id },
          data: {
            currentBalance: { increment: balanceChange },
          },
        });
      }

      if (existing.status === "FINAL") {
        await journalForCancelledSalesBill(tx, tenantId, {
          id: existing.id,
          billNumber: existing.billNumber,
          partyId: party.id,
          partyName: party.name,
          subtotal: existing.subtotal.toNumber(),
          taxAmount: existing.taxAmount.toNumber(),
          grandTotal: existing.grandTotal.toNumber(),
          createdBy: userId || existing.createdBy,
          entryDate: new Date(),
          isInterState: existing.isInterState,
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError("bills.cancel.error", { requestId: getRequestId(request), error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
