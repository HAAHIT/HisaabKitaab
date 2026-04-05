import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  resolveTenantIdFromRequest,
  TENANT_CONTEXT_MISSING_MESSAGE,
} from "@/lib/tenant";
import { resolveVerifiedTenantId } from "@/lib/session-server";
import { logError, getRequestId } from "@/lib/observability";
import {
  normalizeItemNumber,
  normalizeItemUnit,
} from "@/lib/item-catalog";

export const runtime = "nodejs";

function canViewItems(role: string | null) {
  return Boolean(role) && role !== "CUSTOMER";
}

function canManageItems(role: string | null) {
  return role === "ADMIN";
}

export async function GET(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  const tenantId = resolveTenantIdFromRequest(request);

  if (!canViewItems(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: TENANT_CONTEXT_MISSING_MESSAGE },
      { status: 500 }
    );
  }

  const items = await prisma.itemCatalog.findMany({
    where: {
      tenantId,
      isActive: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  const tenantId = await resolveVerifiedTenantId(request);

  if (!canManageItems(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: TENANT_CONTEXT_MISSING_MESSAGE },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const hsnCode =
      typeof body.hsnCode === "string" && body.hsnCode.trim()
        ? body.hsnCode.trim()
        : null;
    const rate = normalizeItemNumber(body.rate, 0);
    const taxRate = normalizeItemNumber(body.taxRate, null);

    if (!name) {
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

    if (taxRate === null && body.taxRate !== undefined && body.taxRate !== "") {
      return NextResponse.json(
        { error: "Tax rate must be a valid number" },
        { status: 400 }
      );
    }

    const itemId = crypto.randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "ItemCatalog" (
        "id",
        "tenantId",
        "name",
        "hsnCode",
        "unit",
        "rate",
        "taxRate",
        "isActive",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${itemId},
        ${tenantId},
        ${name},
        ${hsnCode},
        ${normalizeItemUnit(body.unit)},
        ${rate},
        ${taxRate},
        true,
        NOW(),
        NOW()
      )
    `;

    const item = await prisma.itemCatalog.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new Error("Failed to create item");
    }

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    logError("items.create.error", { requestId: getRequestId(request), error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
