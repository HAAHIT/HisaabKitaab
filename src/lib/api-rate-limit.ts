import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const WINDOW_MS = 60_000; /**
 * Extracts the client's IP address from the request headers.
 *
 * @param request - The incoming request whose headers are inspected; the function prefers the first value of `x-forwarded-for`, then `x-real-ip`.
 * @returns The client IP string extracted from headers, or `"unknown"` if no suitable header is present.
 */

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

/**
 * Enforces a per-endpoint, per-IP rate limit persisted in the database.
 *
 * If the requester has exceeded `limit` within the current 60-second window, returns a `NextResponse` with HTTP 429 and a `Retry-After` header set to the remaining seconds; otherwise initializes or increments the stored counter and returns `null`. If the rate-limit check fails (e.g., database error), the function returns `null` to allow the request.
 *
 * @param request - Incoming request used to extract the client IP
 * @param key - Short identifier for the endpoint (for example, "measurements.upload")
 * @param limit - Maximum requests allowed per minute from a single IP
 * @returns A `NextResponse` with status 429 and a `Retry-After` header when the limit is exceeded, `null` otherwise
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
