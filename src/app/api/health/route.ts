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
    // [FIX #42] Use ORM method instead of $queryRaw (AGENTS.md compliance)
    await prisma.tenant.findFirst({ take: 1, select: { id: true } });

    // Check for unapplied migrations — a finished_at of NULL means the migration
    // ran but never completed (interrupted), which signals a bad deploy.
    const [migRow] = await prisma.$queryRaw<[{ pending: bigint }]>`
      SELECT COUNT(*) AS pending
      FROM "_prisma_migrations"
      WHERE finished_at IS NULL
        AND rolled_back_at IS NULL
    `;
    const migrationStatus: "ok" | "pending" = Number(migRow.pending) === 0 ? "ok" : "pending";

    const overallStatus =
      storage.status !== "ok" || migrationStatus !== "ok" ? "degraded" : "ok";

    const response = NextResponse.json(
      {
        status: overallStatus,
        requestId,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        checks: {
          database: "ok",
          migrations: migrationStatus,
          storage: storage.status,
        },
      },
      { status: overallStatus === "ok" ? 200 : 503 }
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
          migrations: "unknown",
          storage: storage.status,
        },
      },
      { status: 503 }
    );

    response.headers.set("Cache-Control", "no-store");
    return attachRequestIdHeader(response, requestId);
  }
}
