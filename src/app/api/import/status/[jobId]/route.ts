import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveWriteTenant } from "@/lib/api-tenant";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const tenantResolution = await resolveWriteTenant(request);
  if (!tenantResolution.ok) {
    return tenantResolution.response;
  }
  const tenantId = tenantResolution.tenantId;

  const { jobId } = await params;

  const job = await prisma.importJob.findUnique({
    where: { id: jobId }
  });

  if (!job || job.tenantId !== tenantId) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: job.id,
    status: job.status,
    totalItems: job.totalItems,
    processed: job.processed,
    failed: job.failed,
    skipped: job.skipped,
    partiesCreated: job.partiesCreated,
    failures: job.failures ?? null,
    roundOffAdjustments: job.roundOffAdjustments ?? null,
    error: job.error
  });
}
