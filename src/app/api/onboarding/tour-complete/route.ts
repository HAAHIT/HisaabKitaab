import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveVerifiedSession } from "@/lib/session-server";
import { logError, getRequestId, attachRequestIdHeader } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const session = await resolveVerifiedSession(request);
  if (!session) {
    return attachRequestIdHeader(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      requestId
    );
  }
  const { tenantId } = session;

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const current = (tenant?.settings as Record<string, unknown> | null) ?? {};
    const next = { ...current, tourCompleted: true };
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: next as Prisma.InputJsonValue },
    });
    return attachRequestIdHeader(NextResponse.json({ data: { tourCompleted: true } }), requestId);
  } catch (error) {
    logError("onboarding.tour-complete.error", { requestId, error });
    return attachRequestIdHeader(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      requestId
    );
  }
}
