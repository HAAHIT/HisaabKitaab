import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveReadTenant, resolveWriteTenant } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";
import { checkRateLimit } from "@/lib/api-rate-limit";
import {
  normalizeItemNumber,
  normalizeItemUnit,
} from "@/lib/item-catalog";

export const runtime = "nodejs";

/**
 * Check if a user role is permitted to view item catalog entries.
 *
 * @param role - The user's role value (may be `null` when absent)
 * @returns `true` if `role` is present and not equal to `"CUSTOMER"`, `false` otherwise
 */
function canViewItems(role: string | null) {
  return Boolean(role) && role !== "CUSTOMER";
}

/**
 * Determine whether the given role has permission to create or modify items.
 *
 * @param role - The user's role identifier or `null` if unauthenticated
 * @returns `true` if the role is "ADMIN", `false` otherwise
 */
function canManageItems(role: string | null) {
  return role === "ADMIN";
}

/**
 * Fetches active item catalog records for the resolved tenant and returns them ordered by name.
 *
 * @returns A NextResponse containing `{ items }` where `items` is an array of active item catalog entries for the resolved tenant. May instead be a 403 response when the caller is not authorized or the tenant resolution's error response when tenant resolution fails.
 */
export async function GET(request: NextRequest) {
  const role = request.headers.get("x-user-role");

  if (!canViewItems(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const tenantResolution = resolveReadTenant(request);
  if (!tenantResolution.ok) {
    return tenantResolution.response;
  }
  const tenantId = tenantResolution.tenantId;

  const items = await prisma.itemCatalog.findMany({
    where: {
      tenantId,
      isActive: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ items });
}

/**
 * Create a new item in the tenant's item catalog.
 *
 * Enforces a per-request rate limit and requires the caller to have the `ADMIN` role.
 * Resolves the write tenant, validates and normalizes the request body, creates the item, and returns the created record.
 *
 * @param request - Incoming Next.js request. The JSON body may include `name`, `hsnCode`, `rate`, `taxRate`, and `unit`. The caller's role is read from the `x-user-role` header.
 * @returns `201` with `{ item }` when creation succeeds; `400` with `{ error: "..."} ` for validation failures (missing `name`, invalid `rate`, or invalid `taxRate` when provided); `403` with `{ error: "Forbidden" }` when the caller lacks permission; the rate limiter's response if the request is rate limited (e.g., `429`); `500` with `{ error: "Internal server error" }` for unexpected errors.
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await checkRateLimit(request, "items.create", 30);
  if (rateLimitResponse) return rateLimitResponse;

  const role = request.headers.get("x-user-role");

  if (!canManageItems(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const tenantResolution = await resolveWriteTenant(request);
  if (!tenantResolution.ok) {
    return tenantResolution.response;
  }
  const tenantId = tenantResolution.tenantId;

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
