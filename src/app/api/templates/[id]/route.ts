import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import {
  resolveTenantIdFromRequest,
  TENANT_CONTEXT_MISSING_MESSAGE,
} from "@/lib/tenant";
import { resolveVerifiedTenantId } from "@/lib/session-server";
import { logError, getRequestId } from "@/lib/observability";

export const runtime = "nodejs";

// GET /api/templates/[id] — Get a single template
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = request.headers.get("x-user-role");
  const tenantId = resolveTenantIdFromRequest(request);

  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: TENANT_CONTEXT_MISSING_MESSAGE },
      { status: 500 }
    );
  }

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

// PATCH /api/templates/[id] — Update template (Admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = request.headers.get("x-user-role");
  const tenantId = await resolveVerifiedTenantId(request);

  if (role !== "ADMIN") {
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

// DELETE /api/templates/[id] — Delete template (Admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = request.headers.get("x-user-role");
  const tenantId = await resolveVerifiedTenantId(request);

  if (role !== "ADMIN") {
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
