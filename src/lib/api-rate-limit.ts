import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// NOTE: This is an in-memory store — limits are per-process.
// For multi-instance deployments, replace with a shared store (e.g. Redis / Upstash).
const WINDOW_MS = 60_000; // 1 minute sliding window

type Entry = { count: number; windowStart: number };
const store = new Map<string, Entry>();

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

/**
 * Check the rate limit for a given (endpoint key, client IP) pair.
 *
 * Returns a 429 NextResponse if the limit is exceeded, or null if the
 * request is allowed. Call this at the top of any mutation handler.
 *
 * @param request  Incoming request (used to extract client IP)
 * @param key      Short identifier for the endpoint, e.g. "measurements.upload"
 * @param limit    Max requests per minute from a single IP
 */
export function checkRateLimit(
  request: NextRequest,
  key: string,
  limit: number
): NextResponse | null {
  const ip = getClientIp(request);
  const storeKey = `${key}:${ip}`;
  const now = Date.now();
  const entry = store.get(storeKey);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    store.set(storeKey, { count: 1, windowStart: now });
    return null;
  }

  if (entry.count >= limit) {
    const retryAfter = Math.ceil((entry.windowStart + WINDOW_MS - now) / 1000);
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  entry.count++;
  return null;
}
