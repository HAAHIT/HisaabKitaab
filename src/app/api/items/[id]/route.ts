import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  resolveTenantIdFromRequest,
  TENANT_CONTEXT_MISSING_MESSAGE,
} from "@/lib/tenant";
import { resolveVerifiedTenantId } from "@/lib/session-server";
import {
  normalizeItemNumber,
  normalizeItemUnit,
} from "@/lib/item-catalog";

export const runtime = "nodejs";

function isAdmin(request: NextRequest) {
  return request.headers.get("x-user-role") === "ADMIN";
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantId = await resolveVerifiedTenantId(request);

  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: TENANT_CONTEXT_MISSING_MESSAGE },
      { status: 500 }
    );
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const name =
      body.name === undefined
        ? undefined
        : typeof body.name === "string"
          ? body.name.trim()
          : "";
    const hsnCode =
      body.hsnCode === undefined
        ? undefined
        : typeof body.hsnCode === "string" && body.hsnCode.trim()
          ? body.hsnCode.trim()
          : null;
    const rate =
      body.rate === undefined ? undefined : normalizeItemNumber(body.rate, 0);
    const taxRate =
      body.taxRate === undefined
        ? undefined
        : normalizeItemNumber(body.taxRate, null);

    if (name !== undefined && !name) {
      return NextResponse.json(
        { error: "Item name is required" },
        { status: 400 }
      );
    }

    if (rate === null) {
      return NextResponse.json(
        { error: "Default rate must be a valid number" },
        { status: 400 }
      );
    }

    if (taxRate === null && body.taxRate !== null && body.taxRate !== "") {
      return NextResponse.json(
        { error: "Tax rate must be a valid number" },
        { status: 400 }
      );
    }

    const existingItem = await prisma.itemCatalog.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });

    if (!existingItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const item = await prisma.itemCatalog.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(hsnCode !== undefined ? { hsnCode } : {}),
        ...(body.unit !== undefined ? { unit: normalizeItemUnit(body.unit) } : {}),
        ...(rate !== undefined ? { rate } : {}),
        ...(taxRate !== undefined ? { taxRate } : {}),
      },
    });

    return NextResponse.json({ item });
  } catch (error) {
    console.error("Update item error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantId = await resolveVerifiedTenantId(request);

  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: TENANT_CONTEXT_MISSING_MESSAGE },
      { status: 500 }
    );
  }

  try {
    const { id } = await params;

    const existingItem = await prisma.itemCatalog.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });

    if (!existingItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    await prisma.itemCatalog.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete item error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
