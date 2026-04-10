import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const WINDOW_MS = 60_000; // 1 minute sliding window

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

/**
 * Check the rate limit for a given (endpoint key, client IP) pair.
 * Backed by the database — works correctly across multiple server instances.
 *
 * Returns a 429 NextResponse if the limit is exceeded, or null if allowed.
 * Call this at the top of any mutation handler.
 *
 * @param request  Incoming request (used to extract client IP)
 * @param key      Short identifier for the endpoint, e.g. "measurements.upload"
 * @param limit    Max requests per minute from a single IP
 */
export async function checkRateLimit(
  request: NextRequest,
  key: string,
  limit: number
): Promise<NextResponse | null> {
  const ip = getClientIp(request);
  const storeKey = `${key}:${ip}`;
  const now = new Date();
  const windowCutoff = new Date(now.getTime() - WINDOW_MS);

  try {
    const existing = await prisma.apiRateLimit.findUnique({
      where: { key: storeKey },
    });

    if (!existing || existing.windowStart < windowCutoff) {
      await prisma.apiRateLimit.upsert({
        where: { key: storeKey },
        create: { key: storeKey, count: 1, windowStart: now },
        update: { count: 1, windowStart: now },
      });
      return null;
    }

    if (existing.count >= limit) {
      const retryAfter = Math.ceil(
        (existing.windowStart.getTime() + WINDOW_MS - now.getTime()) / 1000
      );
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    await prisma.apiRateLimit.update({
      where: { key: storeKey },
      data: { count: { increment: 1 } },
    });

    // Non-blocking prune of expired rows — no await, never blocks the response
    void prisma.apiRateLimit
      .deleteMany({ where: { windowStart: { lt: windowCutoff } } })
      .catch(() => undefined);

    return null;
  } catch {
    // If the rate limit check itself fails, allow the request through
    // rather than blocking legitimate traffic.
    return null;
  }
}
