import { NextRequest, NextResponse } from "next/server";
import { logError, getRequestId } from "@/lib/observability";
import { resolveSuperAdminSession } from "@/lib/session-server";
import { globalSearch } from "@/lib/admin-stats";

export async function GET(request: NextRequest) {
  const session = await resolveSuperAdminSession(request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  try {
    const data = await globalSearch(q);
    return NextResponse.json({ data });
  } catch (error) {
    logError("admin.stats.search.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
