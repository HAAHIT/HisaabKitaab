import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSession } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";

export const runtime = "nodejs";

const MAX_IDS = 500;

export async function POST(request: NextRequest) {
  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, role } = sessionResolution.session;

  if (role !== "ADMIN" && role !== "ACCOUNTANT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { ids?: unknown; action?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : [];
  const action = typeof body.action === "string" ? body.action : "";

  if (ids.length === 0) {
    return NextResponse.json({ error: "No IDs provided" }, { status: 400 });
  }
  if (ids.length > MAX_IDS) {
    return NextResponse.json(
      { error: `Maximum ${MAX_IDS} bills per request` },
      { status: 400 }
    );
  }

  try {
    if (action === "DELETE_DRAFTS") {
      // Soft-delete only DRAFT bills scoped to this tenant.
      const result = await prisma.bill.updateMany({
        where: {
          id: { in: ids },
          tenantId,
          status: "DRAFT",
          isDeleted: false,
        },
        data: { isDeleted: true },
      });
      return NextResponse.json({
        data: {
          action: "DELETE_DRAFTS",
          requested: ids.length,
          updated: result.count,
        },
      });
    }

    if (action === "CANCEL_DRAFTS") {
      const result = await prisma.bill.updateMany({
        where: {
          id: { in: ids },
          tenantId,
          status: "DRAFT",
          isDeleted: false,
        },
        data: { status: "CANCELLED" },
      });
      return NextResponse.json({
        data: {
          action: "CANCEL_DRAFTS",
          requested: ids.length,
          updated: result.count,
        },
      });
    }

    return NextResponse.json(
      {
        error:
          "Unsupported action. Supported: DELETE_DRAFTS, CANCEL_DRAFTS. Finalising bills must be done individually so that journal entries are posted correctly.",
      },
      { status: 400 }
    );
  } catch (error) {
    logError("bills.bulk.error", {
      requestId: getRequestId(request),
      error,
    });
    return NextResponse.json(
      { error: "Bulk operation failed" },
      { status: 500 }
    );
  }
}
