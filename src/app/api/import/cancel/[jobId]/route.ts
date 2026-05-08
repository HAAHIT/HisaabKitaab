import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSession } from "@/lib/api-tenant";
import { logInfo, logError, getRequestId } from "@/lib/observability";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const reqId = getRequestId(request);
  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, role } = sessionResolution.session;

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { jobId } = await params;

  try {
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
  } catch (error) {
    logError("import.cancel.error", { requestId: reqId, error });
    return NextResponse.json({ error: "Failed to cancel import" }, { status: 500 });
  }
}
