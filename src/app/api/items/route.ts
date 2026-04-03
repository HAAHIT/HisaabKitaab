import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/tenant";
import {
  normalizeItemNumber,
  normalizeItemUnit,
} from "@/lib/item-catalog";

function canViewItems(role: string | null) {
  return Boolean(role) && role !== "CUSTOMER";
}

function canManageItems(role: string | null) {
  return role === "ADMIN";
}

export async function GET(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  if (!canViewItems(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantId = await getTenantId();
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
  if (!canManageItems(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const tenantId = await getTenantId();
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

    const item = await prisma.itemCatalog.create({
      data: {
        tenantId,
        name,
        hsnCode,
        unit: normalizeItemUnit(body.unit),
        rate,
        taxRate,
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("Create item error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
