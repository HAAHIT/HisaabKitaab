import { NextRequest, NextResponse } from "next/server";
import { logError, getRequestId } from "@/lib/observability";
import { resolveSuperAdminSession } from "@/lib/session-server";
import { getPlatformOverview } from "@/lib/admin-stats";

export async function GET(request: NextRequest) {
  const session = await resolveSuperAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const data = await getPlatformOverview();
    return NextResponse.json({ data });
  } catch (error) {
    logError("admin.stats.overview.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
