import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveWriteTenant } from "@/lib/api-tenant";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const tenantResolution = await resolveWriteTenant(request);
  if (!tenantResolution.ok) {
    return tenantResolution.response;
  }
  const tenantId = tenantResolution.tenantId;

  const job = await prisma.importJob.findUnique({
    where: { id: params.jobId }
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
    error: job.error
  });
}
