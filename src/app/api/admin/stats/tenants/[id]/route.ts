import { NextRequest, NextResponse } from "next/server";
import { logError, getRequestId } from "@/lib/observability";
import { resolveSuperAdminSession } from "@/lib/session-server";
import { getTenantDetail } from "@/lib/admin-stats";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await resolveSuperAdminSession(request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await context.params;
  try {
    const data = await getTenantDetail(id);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data });
  } catch (error) {
    logError("admin.stats.tenant.detail.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
