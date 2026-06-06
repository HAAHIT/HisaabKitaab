import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSession } from "@/lib/api-tenant";
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
  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, role } = sessionResolution.session;

  if (!canViewItems(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = (searchParams.get("search") || "").trim();
  // `limit`/`page` are optional. Without them the full active catalog is
  // returned (back-compat for the bill/purchase forms that load all items
  // for client-side selection). With them, results are paginated.
  const limitParam = searchParams.get("limit");
  const pageParam = searchParams.get("page");
  const paginate = limitParam !== null || pageParam !== null;
  const limit = Math.min(Math.max(1, parseInt(limitParam || "50", 10) || 50), 200);
  const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);

  const where = {
    tenantId,
    isActive: true,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { hsnCode: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  if (!paginate) {
    const items = await prisma.itemCatalog.findMany({
      where,
      orderBy: { name: "asc" },
      ...(search ? { take: 50 } : {}),
    });
    return NextResponse.json({ items });
  }

  const [items, total] = await Promise.all([
    prisma.itemCatalog.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.itemCatalog.count({ where }),
  ]);

  return NextResponse.json({
    items,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = await checkRateLimit(request, "items.create", 30);
  if (rateLimitResponse) return rateLimitResponse;

  const sessionResolution2 = await resolveSession(request);
  if (!sessionResolution2.ok) return sessionResolution2.response;
  const { tenantId, role } = sessionResolution2.session;

  if (!canManageItems(role)) {
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
