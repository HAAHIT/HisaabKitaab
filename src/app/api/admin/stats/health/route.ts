import { NextRequest, NextResponse } from "next/server";
import { logError, getRequestId } from "@/lib/observability";
import { resolveSuperAdminSession } from "@/lib/session-server";
import { getSystemHealth } from "@/lib/admin-stats";

export async function GET(request: NextRequest) {
  const session = await resolveSuperAdminSession(request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const data = await getSystemHealth();
    return NextResponse.json({ data });
  } catch (error) {
    logError("admin.stats.health.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
