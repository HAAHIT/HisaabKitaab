import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveWriteTenant } from "@/lib/api-tenant";

export const runtime = "nodejs";

/**
 * GET /api/import/active
 *
 * Returns the most recent PENDING or PROCESSING import job for the tenant,
 * so the UI can resume the progress bar after a page refresh.
 */
export async function GET(request: NextRequest) {
  const tenantResolution = await resolveWriteTenant(request);
  if (!tenantResolution.ok) {
    return tenantResolution.response;
  }
  const tenantId = tenantResolution.tenantId;

  const job = await prisma.importJob.findFirst({
    where: {
      tenantId,
      status: { in: ["PENDING", "PROCESSING"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!job) {
    return NextResponse.json({ active: false });
  }

  return NextResponse.json({
    active: true,
    jobId: job.id,
    status: job.status,
    stage: job.stage,
    totalItems: job.totalItems,
    processed: job.processed,
    failed: job.failed,
    partiesCreated: job.partiesCreated,
  });
}
