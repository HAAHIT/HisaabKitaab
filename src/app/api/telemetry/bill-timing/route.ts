import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/api-tenant";
import { logInfo, logError, getRequestId } from "@/lib/observability";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { z } from "zod";

export const runtime = "nodejs";

const Schema = z.object({
  secondsToFinalize: z.number().positive().finite(),
  billId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, userId, role } = sessionResolution.session;

  if (role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rateLimited = await checkRateLimit(request, "telemetry.bill-timing", 10);
  if (rateLimited) return rateLimited;

  try {
    const raw = await request.json().catch(() => null);
    const parsed = Schema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const { secondsToFinalize, billId } = parsed.data;

    logInfo("telemetry.bill.time_to_finalize", {
      tenantId,
      userId,
      billId,
      secondsToFinalize: Math.round(secondsToFinalize * 10) / 10,
      under30s: secondsToFinalize < 30,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("telemetry.bill.timing.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
