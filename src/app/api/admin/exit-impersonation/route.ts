import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, signToken } from "@/lib/auth";
import { SESSION_COOKIE_NAME } from "@/lib/cookie";
import { logError, logInfo, getRequestId } from "@/lib/observability";

// Restores the superadmin session encoded in impersonatedBy. Works on both
// POST (from a button) and GET (so a banner link can hit it and redirect).
async function handle(request: NextRequest, redirectOnSuccess: boolean) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session || !session.impersonatedBy) {
    if (redirectOnSuccess) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.json({ error: "Not impersonating" }, { status: 400 });
  }

  try {
    const superadmin = await prisma.user.findUnique({
      where: { id: session.impersonatedBy },
      select: { id: true, name: true, role: true, email: true, phone: true, tenantId: true, isActive: true },
    });
    if (!superadmin || !superadmin.isActive || superadmin.role !== "SUPERADMIN") {
      const res = redirectOnSuccess
        ? NextResponse.redirect(new URL("/login", request.url))
        : NextResponse.json({ error: "Superadmin no longer active" }, { status: 403 });
      res.cookies.delete(SESSION_COOKIE_NAME);
      return res;
    }

    const newToken = await signToken({
      userId: superadmin.id,
      tenantId: superadmin.tenantId,
      name: superadmin.name,
      role: superadmin.role,
      email: superadmin.email ?? undefined,
      phone: superadmin.phone ?? undefined,
    });

    await prisma.auditLog.create({
      data: {
        tenantId: session.tenantId,
        entityType: "User",
        entityId: session.userId,
        userId: superadmin.id,
        action: "IMPERSONATION_END",
        actorType: "SYSTEM",
      },
    });
    logInfo("admin.impersonation.end", {
      requestId: getRequestId(request),
      superadminId: superadmin.id,
      targetUserId: session.userId,
    });

    const response = redirectOnSuccess
      ? NextResponse.redirect(new URL("/admin/stats", request.url))
      : NextResponse.json({ data: { restored: true, redirectTo: "/admin/stats" } });
    response.cookies.set(SESSION_COOKIE_NAME, newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });
    return response;
  } catch (error) {
    logError("admin.impersonation.end.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return handle(request, false);
}

export async function GET(request: NextRequest) {
  return handle(request, true);
}
