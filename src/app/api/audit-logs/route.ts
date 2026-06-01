import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSession } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";

export const runtime = "nodejs";

const MAX_PAGE_SIZE = 100;

export async function GET(request: NextRequest) {
  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, role } = sessionResolution.session;

  if (role !== "ADMIN" && role !== "ACCOUNTANT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");
  const action = searchParams.get("action");
  const fromParam = searchParams.get("from"); // ISO date "YYYY-MM-DD"
  const toParam = searchParams.get("to");
  const format = searchParams.get("format"); // "csv" → CSV download, default JSON
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(searchParams.get("pageSize") || "50", 10))
  );

  // Parse date range (interpret as IST, inclusive of both ends).
  function parseIstBound(value: string | null, endOfDay: boolean): Date | null {
    if (!value) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const [, y, m, d] = match;
    // IST is UTC+5:30. Start of IST day = UTC 18:30 of previous day; end = UTC 18:29:59.999 of same day.
    const baseUtc = Date.UTC(Number(y), Number(m) - 1, Number(d), endOfDay ? 18 : -5, endOfDay ? 29 : 30, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
    return new Date(baseUtc);
  }
  const from = parseIstBound(fromParam, false);
  const to = parseIstBound(toParam, true);

  try {
    const where: Record<string, unknown> = { tenantId };
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (action) where.action = action;
    if (from || to) {
      const range: Record<string, Date> = {};
      if (from) range.gte = from;
      if (to) range.lte = to;
      where.createdAt = range;
    }

    if (format === "csv") {
      // Full export — no pagination. Cap at 50k rows to protect memory.
      const CSV_MAX = 50000;
      const logs = await prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: CSV_MAX,
      });
      const userIds = [...new Set(logs.map((l) => l.userId).filter((id): id is string => !!id))];
      const users = userIds.length
        ? await prisma.user.findMany({
            where: { id: { in: userIds }, tenantId },
            select: { id: true, name: true, email: true },
          })
        : [];
      const userMap = new Map(users.map((u) => [u.id, u]));

      const escape = (v: unknown) => {
        const s = v === null || v === undefined ? "" : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const header = ["timestamp_ist", "entity_type", "entity_id", "action", "field", "old_value", "new_value", "actor_type", "user_name", "user_email"];
      const lines = [header.join(",")];
      const istFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
      for (const log of logs) {
        const user = log.userId ? userMap.get(log.userId) : null;
        lines.push([
          istFormatter.format(log.createdAt).replace(",", ""),
          log.entityType,
          log.entityId,
          log.action,
          log.fieldName ?? "",
          log.oldValue ?? "",
          log.newValue ?? "",
          log.actorType,
          user?.name ?? "",
          user?.email ?? "",
        ].map(escape).join(","));
      }
      const filename = `audit-log${fromParam ? `-${fromParam}` : ""}${toParam ? `_to_${toParam}` : ""}.csv`;
      return new NextResponse(lines.join("\n"), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    const userIds = [
      ...new Set(
        logs
          .map((l) => l.userId)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    const users =
      userIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: userIds }, tenantId },
            select: { id: true, name: true, email: true },
          })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const data = logs.map((log) => ({
      id: log.id,
      entityType: log.entityType,
      entityId: log.entityId,
      action: log.action,
      fieldName: log.fieldName,
      oldValue: log.oldValue,
      newValue: log.newValue,
      createdAt: log.createdAt,
      actorType: log.actorType,
      user: log.userId
        ? userMap.get(log.userId) ?? { id: log.userId, name: "Unknown", email: null }
        : null,
    }));

    return NextResponse.json({
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error) {
    logError("audit-logs.list.error", {
      requestId: getRequestId(request),
      error,
    });
    return NextResponse.json(
      { error: "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}
