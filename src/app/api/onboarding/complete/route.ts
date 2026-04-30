import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveVerifiedTenantId } from "@/lib/session-server";
import { logError, logInfo, getRequestId } from "@/lib/observability";

export const runtime = "nodejs";

/**
 * POST /api/onboarding/complete
 * Marks the tenant's onboarding as complete.
 * Should be called only after the final wizard step.
 */
export async function POST(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantId = await resolveVerifiedTenantId(request);
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
