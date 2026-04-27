import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveWriteSession } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";
import { checkRateLimit } from "@/lib/api-rate-limit";
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
  // [FIX] Use JWT-verified session instead of trusting proxy headers
  const sessionResolution = await resolveWriteSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, role } = sessionResolution.session;

  if (role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));

  const where = {
    tenantId,
    isActive: true,
    ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.itemCatalog.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.itemCatalog.count({ where }),
  ]);

  return NextResponse.json({ items, total, page, totalPages: Math.ceil(total / limit) });
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = await checkRateLimit(request, "items.create", 30);
  if (rateLimitResponse) return rateLimitResponse;

  // [FIX] Use JWT-verified session instead of trusting proxy headers
  const sessionResolution = await resolveWriteSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, role } = sessionResolution.session;

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    const item = await prisma.itemCatalog.create({
      data: {
        tenantId,
        name,
        hsnCode,
        unit: normalizeItemUnit(body.unit),
        rate,
        taxRate,
        isActive: true,
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    logError("items.create.error", { requestId: getRequestId(request), error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
