import { prisma } from "@/lib/prisma";
import { resolveReadTenant, resolveWriteTenant } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Lists bill templates for the resolved tenant, excluding templates marked as deleted.
 *
 * @returns A JSON response with `templates`: an array of objects each containing `id`, `name`, `columns`, `createdAt`, `updatedAt`, and `_count.bills`. Returns a `403` response when the caller's role is insufficient or the tenant resolver's error response on resolution failure.
 */
export async function GET(request: NextRequest) {
  const role = request.headers.get("x-user-role");

  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const tenantResolution = resolveReadTenant(request);
  if (!tenantResolution.ok) {
    return tenantResolution.response;
  }
  const tenantId = tenantResolution.tenantId;

  const templates = await prisma.billTemplate.findMany({
    where: {
      tenantId,
      isDeleted: false,
    },
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

/**
 * Create a new bill template for the resolved tenant when invoked by an admin user.
 *
 * Validates rate limits, admin role, user context, tenant write access, and request body.
 *
 * @param request - NextRequest containing:
 *   - headers: `x-user-role` (must be `"ADMIN"`) and `x-user-id` (creator's id)
 *   - JSON body: `{ name: string, columns: unknown[] }` where `columns` must be a non-empty array
 * @returns The HTTP JSON response:
 *   - `201` with `{ template }` on success
 *   - `400` if `name` or `columns` are missing/invalid
 *   - `401` if `x-user-id` is missing
 *   - `403` if the caller is not an admin
 *   - the rate limit response if rate-limited
 *   - `500` with an error message on unexpected errors
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await checkRateLimit(request, "templates.create", 10);
  if (rateLimitResponse) return rateLimitResponse;

  const role = request.headers.get("x-user-role");
  const userId = request.headers.get("x-user-id");

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!userId) {
    return NextResponse.json({ error: "Missing user context" }, { status: 401 });
  }
  const tenantResolution = await resolveWriteTenant(request);
  if (!tenantResolution.ok) {
    return tenantResolution.response;
  }
  const tenantId = tenantResolution.tenantId;

  try {
    const body = await request.json();
    const { name, columns } = body;

    if (!name || !columns || !Array.isArray(columns) || columns.length === 0) {
      return NextResponse.json(
        { error: "Template name and at least one column are required" },
        { status: 400 }
      );
    }

    const template = await prisma.billTemplate.create({
      data: {
        tenantId,
        name,
        columns,
        createdBy: userId,
        isDeleted: false,
      },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    logError("templates.create.error", { requestId: getRequestId(request), error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
