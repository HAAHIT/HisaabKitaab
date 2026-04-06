import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { resolveReadTenant } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const tenantResolution = resolveReadTenant(request);
    if (!tenantResolution.ok) {
      return tenantResolution.response;
    }

    if (tenantResolution.tenantId !== session.tenantId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findFirst({
      where: {
        id: session.userId,
        tenantId: tenantResolution.tenantId,
        isActive: true,
      },
      select: {
        id: true,
        tenantId: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    logError("auth.me.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
