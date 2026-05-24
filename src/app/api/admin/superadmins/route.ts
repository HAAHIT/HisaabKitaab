import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { logError, getRequestId } from "@/lib/observability";
import { resolveSuperAdminSession } from "@/lib/session-server";

export async function GET(request: NextRequest) {
  const session = await resolveSuperAdminSession(request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const users = await prisma.user.findMany({
      where: { role: "SUPERADMIN" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        createdAt: true,
        tenantId: true,
      },
    });
    return NextResponse.json({
      data: users.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
        isSelf: u.id === session.userId,
      })),
    });
  } catch (error) {
    logError("admin.superadmins.list.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await resolveSuperAdminSession(request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { name?: unknown; email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!name || !email || !password) {
    return NextResponse.json({ error: "name, email, password required" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  if (password.length < 10) {
    return NextResponse.json({ error: "Password must be at least 10 characters" }, { status: 400 });
  }

  try {
    const creator = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { tenantId: true },
    });
    if (!creator) return NextResponse.json({ error: "Creator not found" }, { status: 404 });

    const existing = await prisma.user.findFirst({
      where: { email, tenantId: creator.tenantId },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 409 });
    }

    const hashed = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        role: "SUPERADMIN",
        tenantId: creator.tenantId,
        createdBy: session.userId,
      },
      select: { id: true, name: true, email: true, createdAt: true, isActive: true, tenantId: true },
    });

    return NextResponse.json({
      data: { ...user, createdAt: user.createdAt.toISOString(), isSelf: false },
    });
  } catch (error) {
    logError("admin.superadmins.create.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
