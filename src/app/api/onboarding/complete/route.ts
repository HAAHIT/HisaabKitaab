import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSession } from "@/lib/api-tenant";
import { logError, logInfo, getRequestId } from "@/lib/observability";

export const runtime = "nodejs";

/**
 * POST /api/onboarding/complete
 * Marks the tenant's onboarding as complete.
 * Should be called only after the final wizard step.
 */
export async function POST(request: NextRequest) {
  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, role } = sessionResolution.session;

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { isOnboardingComplete: true },
    });

    logInfo("onboarding.complete", { requestId: getRequestId(request), tenantId });
    return NextResponse.json({ success: true });
  } catch (error) {
    logError("onboarding.complete.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
