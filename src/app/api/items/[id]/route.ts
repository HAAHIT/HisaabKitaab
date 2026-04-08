import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveWriteTenant } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";
import {
  normalizeItemNumber,
  normalizeItemUnit,
} from "@/lib/item-catalog";

export const runtime = "nodejs";

/**
 * Checks whether the request is from an admin by inspecting the `x-user-role` header.
 *
 * @param request - The incoming Next.js request
 * @returns `true` if the `x-user-role` header equals `"ADMIN"`, `false` otherwise.
 */
function isAdmin(request: NextRequest) {
  return request.headers.get("x-user-role") === "ADMIN";
}

/**
 * Updates fields of an existing item in the tenant-scoped item catalog.
 *
 * The request must be from an admin (header `x-user-role: ADMIN`). The handler resolves the write tenant and uses its `tenantId` to verify the item exists; if found, it updates only the fields provided in the request body. Validation rules:
 * - If `name` is provided it must be a non-empty string.
 * - `rate` must be a valid number when provided.
 * - `taxRate` must be a valid number when explicitly provided (non-empty).
 * - `hsnCode` is normalized: omitted => unchanged, empty/invalid string => `null`, trimmed non-empty string => used.
 *
 * @param request - The NextRequest for the PATCH operation; must include admin role header.
 * @param params - A promise resolving to route parameters containing `id` (the item id).
 * @returns A JSON NextResponse containing the updated `item` on success; on error returns a JSON error message with an appropriate HTTP status (403, 400, 404, or 500).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(request)) {
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
    logError("items.update.error", { requestId: getRequestId(request), error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Soft-deletes the specified item by setting its `isActive` flag to `false` within the resolved write tenant.
 *
 * @returns `{ success: true }` on successful soft-delete; otherwise a JSON error object with an `error` message and an appropriate HTTP status code (`403` for forbidden, `404` if the item was not found, `500` for internal errors).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const tenantResolution = await resolveWriteTenant(request);
  if (!tenantResolution.ok) {
    return tenantResolution.response;
  }
  const tenantId = tenantResolution.tenantId;

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
    logError("items.delete.error", { requestId: getRequestId(request), error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
