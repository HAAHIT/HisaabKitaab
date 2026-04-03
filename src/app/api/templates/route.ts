import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

function resolveTenantId(request: NextRequest) {
  const fromHeader = request.headers.get("x-tenant-id")?.trim();
  if (fromHeader) {
    return fromHeader;
  }

  const fromEnv = process.env.DEFAULT_TENANT_ID?.trim();
  return fromEnv || null;
}

// GET /api/templates — List all templates
export async function GET(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const templates = await prisma.billTemplate.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      columns: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { bills: true } },
    },
  });

  return NextResponse.json({ templates });
}

// POST /api/templates — Create a new template (Admin only)
export async function POST(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  const userId = request.headers.get("x-user-id");
  const tenantId = resolveTenantId(request);

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!userId) {
    return NextResponse.json({ error: "Missing user context" }, { status: 401 });
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant context missing. Set x-tenant-id or DEFAULT_TENANT_ID." },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { name, columns } = body;

    if (!name || !columns || !Array.isArray(columns) || columns.length === 0) {
      return NextResponse.json(
        { error: "Template name and at least one column are required" },
        { status: 400 }
      );
    }

    const templateId = crypto.randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "BillTemplate" (
        "id",
        "tenantId",
        "name",
        "columns",
        "createdBy",
        "createdAt",
        "updatedAt",
        "isDeleted"
      )
      VALUES (
        ${templateId},
        ${tenantId},
        ${name},
        ${JSON.stringify(columns)}::jsonb,
        ${userId},
        NOW(),
        NOW(),
        false
      )
    `;

    const template = await prisma.billTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new Error("Failed to create template");
    }

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error("Create template error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
