import { NextRequest, NextResponse } from "next/server";
import { logError, getRequestId } from "@/lib/observability";
import { resolveSuperAdminSession } from "@/lib/session-server";
import { listTenantStats } from "@/lib/admin-stats";

export async function GET(request: NextRequest) {
  const session = await resolveSuperAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const offset = Number(url.searchParams.get("offset") ?? "0");
  const search = url.searchParams.get("search") ?? undefined;
  try {
    const data = await listTenantStats({
      limit: Number.isFinite(limit) ? limit : 50,
      offset: Number.isFinite(offset) ? offset : 0,
      search: search?.trim() || undefined,
    });
    return NextResponse.json({ data });
  } catch (error) {
    logError("admin.stats.tenants.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
