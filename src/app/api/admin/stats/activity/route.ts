import { NextRequest, NextResponse } from "next/server";
import { logError, getRequestId } from "@/lib/observability";
import { resolveSuperAdminSession } from "@/lib/session-server";
import { listRecentActivity } from "@/lib/admin-stats";

export async function GET(request: NextRequest) {
  const session = await resolveSuperAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "100");
  const tenantId = url.searchParams.get("tenantId")?.trim() || undefined;
  try {
    const data = await listRecentActivity({
      limit: Number.isFinite(limit) ? limit : 100,
      tenantId,
    });
    return NextResponse.json({ data });
  } catch (error) {
    logError("admin.stats.activity.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
