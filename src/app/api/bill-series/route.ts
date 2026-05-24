import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";
import {
  listBillSeries,
  writeBillSeries,
  isValidPrefix,
  type BillSeries,
} from "@/lib/bill-series";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, role } = sessionResolution.session;

  if (role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const series = await listBillSeries(tenantId);
    return NextResponse.json({ data: series });
  } catch (error) {
    logError("bill-series.list.error", {
      requestId: getRequestId(request),
      error,
    });
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, role } = sessionResolution.session;

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });
  }

  let body: { series?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.series)) {
    return NextResponse.json(
      { error: "Body must include a 'series' array" },
      { status: 400 }
    );
  }

  const parsed: BillSeries[] = [];
  for (const item of body.series) {
    if (!item || typeof item !== "object") {
      return NextResponse.json({ error: "Invalid series entry" }, { status: 400 });
    }
    const s = item as Partial<BillSeries>;
    const prefix = String(s.prefix ?? "").trim().toUpperCase();
    if (!isValidPrefix(prefix)) {
      return NextResponse.json(
        {
          error: `Invalid prefix "${prefix}". Use 1-12 characters: A-Z, 0-9, -, _, /`,
        },
        { status: 400 }
      );
    }
    parsed.push({
      id: String(s.id ?? "") || crypto.randomUUID(),
      name: String(s.name ?? "").trim() || "Untitled",
      prefix,
      isDefault: Boolean(s.isDefault),
    });
  }

  try {
    const saved = await writeBillSeries(tenantId, parsed);
    return NextResponse.json({ data: saved });
  } catch (error) {
    logError("bill-series.update.error", {
      requestId: getRequestId(request),
      error,
    });
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save bill series",
      },
      { status: 400 }
    );
  }
}
