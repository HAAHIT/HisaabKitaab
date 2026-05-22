import { Role } from "@prisma/client";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/lib/api-tenant";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { logError, getRequestId } from "@/lib/observability";

export const runtime = "nodejs";

const VALID_ROLES = new Set(Object.values(Role));

function normalizeOptionalString(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

// GET /api/users — List all users (Admin only)
export async function GET(request: NextRequest) {
  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, role } = sessionResolution.session;

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(
    Math.max(1, parseInt(searchParams.get("limit") || "50", 10) || 50),
    200
  );

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where: { tenantId } }),
  ]);

  return NextResponse.json({
    users,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}

// POST /api/users — Create a new user (Admin only)
export async function POST(request: NextRequest) {
  const rateLimitResponse = await checkRateLimit(request, "users.create", 20);
  if (rateLimitResponse) return rateLimitResponse;

  const sessionResolution = await resolveSession(request);
  if (!sessionResolution.ok) return sessionResolution.response;
  const { tenantId, userId: adminId, role } = sessionResolution.session;

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = normalizeOptionalString(body.email);
    const phone =
      typeof body.phone === "string" ? body.phone.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const userRole =
      typeof body.userRole === "string" ? body.userRole : "STAFF";

    if (!name || !phone || !password) {
      return NextResponse.json(
        { error: "Name, phone, and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 12) {
      return NextResponse.json(
        { error: "Password must be at least 12 characters" },
        { status: 400 }
      );
    }

    if (!VALID_ROLES.has(userRole as Role)) {
      return NextResponse.json(
        { error: "Invalid user role" },
        { status: 400 }
      );
    }

    // Check for duplicates
    if (email) {
      const existing = await prisma.user.findFirst({
        where: {
          tenantId,
          email: { equals: email, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json(
          { error: "A user with this email already exists" },
          { status: 409 }
        );
      }
    }

    const existingPhone = await prisma.user.findFirst({
      where: {
        tenantId,
        phone,
      },
      select: { id: true },
    });
    if (existingPhone) {
      return NextResponse.json(
        { error: "A user with this phone already exists" },
        { status: 409 }
      );
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        tenantId,
        name,
        email: email || null,
        phone,
        password: hashedPassword,
        role: userRole as Role,
        isActive: true,
        createdBy: adminId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    logError("users.create.error", { requestId: getRequestId(request), error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
