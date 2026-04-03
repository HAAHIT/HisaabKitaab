import { Role } from "@prisma/client";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import {
  resolveTenantIdFromRequest,
  TENANT_CONTEXT_MISSING_MESSAGE,
} from "@/lib/tenant";
import { resolveVerifiedTenantId } from "@/lib/session-server";
import { checkRateLimit } from "@/lib/api-rate-limit";

const VALID_ROLES = new Set(Object.values(Role));

function normalizeOptionalString(value: unknown) {
  if (value === null) {
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
  const role = request.headers.get("x-user-role");
  const tenantId = resolveTenantIdFromRequest(request);
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: TENANT_CONTEXT_MISSING_MESSAGE },
      { status: 500 }
    );
  }

  const users = await prisma.user.findMany({
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
  });

  return NextResponse.json({ users });
}

// POST /api/users — Create a new user (Admin only)
export async function POST(request: NextRequest) {
  const rateLimitResponse = checkRateLimit(request, "users.create", 20);
  if (rateLimitResponse) return rateLimitResponse;

  const role = request.headers.get("x-user-role");
  const adminId = request.headers.get("x-user-id");
  // Verify tenantId directly from the JWT cookie — not from the header —
  // so the value used in raw SQL is always cryptographically verified.
  const tenantId = await resolveVerifiedTenantId(request);

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!adminId) {
    return NextResponse.json({ error: "Missing user context" }, { status: 401 });
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: TENANT_CONTEXT_MISSING_MESSAGE },
      { status: 500 }
    );
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

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    if (email === undefined) {
      return NextResponse.json(
        { error: "Email must be a string" },
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

    const userId = crypto.randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "User" (
        "id",
        "tenantId",
        "name",
        "email",
        "phone",
        "password",
        "role",
        "isActive",
        "createdBy",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${userId},
        ${tenantId},
        ${name},
        ${email || null},
        ${phone},
        ${hashedPassword},
        ${userRole}::"Role",
        true,
        ${adminId},
        NOW(),
        NOW()
      )
    `;

    const user = await prisma.user.findUnique({
      where: { id: userId },
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

    if (!user) {
      throw new Error("Failed to create user");
    }

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error("Create user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
