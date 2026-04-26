import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveWriteSession } from "@/lib/api-tenant";
import { logInfo } from "@/lib/observability";

export const runtime = "nodejs";

/**
 * POST /api/import/cancel/[jobId]
 *
 * Marks a PENDING or PROCESSING import job as FAILED so the background
 * processor stops picking up new vouchers. Already-imported data is retained.
 * ADMIN only.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const sessionResolution = await resolveWriteSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, role } = sessionResolution.session;

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { jobId } = await params;

  const updated = await prisma.importJob.updateMany({
    where: {
      id: jobId,
      tenantId,
      status: { in: ["PENDING", "PROCESSING"] },
    },
    data: {
      status: "FAILED",
      stage: "done",
      error: "Cancelled by user",
    },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Job not found or already finished" }, { status: 404 });
  }

  logInfo("import.cancelled", { jobId, tenantId });

  return NextResponse.json({ cancelled: true });
}
