import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { resolveReadTenant } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";

/**
 * Returns the authenticated user's record for the tenant resolved from the request.
 *
 * @param request - The incoming NextRequest used to resolve tenant context and extract request id for error logging
 * @returns A JSON HTTP response:
 * - 200 with `{ user }` where `user` contains `id`, `tenantId`, `name`, `email`, `phone`, `role`, and `isActive` when an active user is found for the session and tenant.
 * - 401 with `{ error: "Not authenticated" }` when there is no session, the tenant does not match the session, or no active user is found.
 * - 500 with `{ error: "Internal server error" }` on unexpected errors (also logged with the request id).
 */
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
