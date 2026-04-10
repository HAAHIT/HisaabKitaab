import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  attachRequestIdHeader,
  getRequestId,
  logError,
} from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getStorageStatus() {
  const provider = (process.env.OBJECT_STORAGE_PROVIDER || "local")
    .trim()
    .toLowerCase();

  if (provider === "local") {
    return { provider, status: "ok" as const };
  }

  if (provider === "gcs") {
    return {
      provider,
      status: process.env.GCS_BUCKET_NAME?.trim() ? ("ok" as const) : ("error" as const),
    };
  }

  return { provider, status: "error" as const };
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const startedAt = Date.now();
  const storage = getStorageStatus();

  try {
    await prisma.$queryRaw`SELECT 1`;

    const status = storage.status === "ok" ? "ok" : "degraded";
    const response = NextResponse.json(
      {
        status,
        requestId,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        checks: {
          database: "ok",
          storage: storage.status,
        },
      },
      { status: status === "ok" ? 200 : 503 }
    );

    response.headers.set("Cache-Control", "no-store");
    return attachRequestIdHeader(response, requestId);
  } catch (error) {
    logError("health.check.failed", {
      requestId,
      durationMs: Date.now() - startedAt,
      storageProvider: storage.provider,
      error,
    });

    const response = NextResponse.json(
      {
        status: "error",
        requestId,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        checks: {
          database: "error",
          storage: storage.status,
        },
      },
      { status: 503 }
    );

    response.headers.set("Cache-Control", "no-store");
    return attachRequestIdHeader(response, requestId);
  }
}
