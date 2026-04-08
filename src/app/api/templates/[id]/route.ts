import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { resolveReadTenant, resolveWriteTenant } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";

export const runtime = "nodejs";

/**
 * Retrieve a non-deleted bill template by id for the resolved read tenant.
 *
 * @param params - An object (promise) that resolves to route parameters; expects `id` as the template identifier
 * @returns A JSON NextResponse with `{ template }` and status 200 if found; `403` with `{ error: "Forbidden" }` when the caller lacks permission; `404` with `{ error: "Template not found" }` when no matching template exists; or the tenant resolution response when tenant resolution fails.
 */
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
  const template = await prisma.billTemplate.findFirst({
    where: {
      id,
      tenantId,
      isDeleted: false,
    },
  });
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return NextResponse.json({ template });
}

/**
 * Update a bill template's `name` and/or `columns` for the resolved write tenant (admin only).
 *
 * @param params - Promise that resolves to route parameters; expects `{ id: string }` identifying the template
 * @returns A NextResponse whose JSON body contains `{ template }` with the updated template on success; otherwise an `{ error }` object with an appropriate HTTP status (`403` for forbidden, `404` if the template is not found, `500` on internal error).
 */
export async function PATCH(
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
    const existingTemplate = await prisma.billTemplate.findFirst({
      where: {
        id,
        tenantId,
        isDeleted: false,
      },
      select: { id: true },
    });
    if (!existingTemplate) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, columns } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (columns !== undefined) updateData.columns = columns;

    const template = await prisma.billTemplate.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ template });
  } catch (error) {
    logError("templates.update.error", { requestId: getRequestId(request), error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Soft-deletes a bill template for the resolved write tenant if no bills reference it (admin only).
 *
 * @param params - A promise resolving to route parameters containing the template `id`.
 * @returns On success, an object `{ success: true }`. On failure, JSON error responses with appropriate HTTP status codes:
 * - `403` when the caller is not an admin
 * - `404` when the template does not exist or is already deleted
 * - `409` when one or more bills reference the template (`{ error: "Cannot delete: N bill(s) use this template" }`)
 * - `500` for internal server errors
 */
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

    // Check if template has bills
    const billCount = await prisma.bill.count({
      where: {
        templateId: id,
        tenantId,
      },
    });
    if (billCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${billCount} bill(s) use this template` },
        { status: 409 }
      );
    }

    const existingTemplate = await prisma.billTemplate.findFirst({
      where: {
        id,
        tenantId,
        isDeleted: false,
      },
      select: { id: true },
    });
    if (!existingTemplate) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    await prisma.billTemplate.update({
      where: { id: existingTemplate.id },
      data: { isDeleted: true },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    logError("templates.delete.error", { requestId: getRequestId(request), error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
