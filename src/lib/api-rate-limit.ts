import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/observability";

const WINDOW_MS = 60_000; // 1 minute sliding window

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ||
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
  // Scope the key by tenant so one tenant's traffic cannot exhaust another's
  // quota. Public paths (no proxy-verified tenant header) fall back to IP-only.
  const tenantId = request.headers.get("x-tenant-id")?.trim();
  const storeKey = tenantId ? `${key}:${tenantId}:${ip}` : `${key}:${ip}`;
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
  } catch (error) {
    // [FIX #6] In-memory fallback if the database is down or connection pool is exhausted.
    // This prevents attackers from exploiting DB downtime to bypass rate limits.
    const fallbackLimit = fallbackCheck(storeKey, limit);
    if (fallbackLimit) {
      return NextResponse.json(
        { error: "Too many requests (fallback-limit). Please try again later." },
        { status: 429 }
      );
    }

    logError("rate-limit.check.error", { key: storeKey, error });
    return null;
  }
}

// Simple in-memory sliding window for fallback
// [FIX #15] Capped at 10k entries to prevent unbounded memory growth
const MEM_LIMIT_MAX_SIZE = 10_000;
const MEM_LIMITS = new Map<string, { count: number; windowStart: number }>();

function fallbackCheck(key: string, limit: number): boolean {
  const now = Date.now();
  const existing = MEM_LIMITS.get(key);

  if (!existing || now - existing.windowStart > WINDOW_MS) {
    // Evict oldest entries if map is at capacity
    if (MEM_LIMITS.size >= MEM_LIMIT_MAX_SIZE) {
      const firstKey = MEM_LIMITS.keys().next().value;
      if (firstKey !== undefined) MEM_LIMITS.delete(firstKey);
    }
    MEM_LIMITS.set(key, { count: 1, windowStart: now });
    return false;
  }

  if (existing.count >= limit) {
    return true;
  }

  existing.count++;
  return false;
}
