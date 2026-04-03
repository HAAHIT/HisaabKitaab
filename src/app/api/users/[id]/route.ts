import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import {
  resolveTenantIdFromRequest,
  TENANT_CONTEXT_MISSING_MESSAGE,
} from "@/lib/tenant";

const VALID_ROLES = new Set(Object.values(Role));

function hasOwn(body: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(body, key);
}

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

// PATCH /api/users/[id] - Update a user (Admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const existingUser = await prisma.user.findFirst({
      where: {
        id,
        tenantId,
      },
      select: { id: true },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (hasOwn(body, "name")) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return NextResponse.json(
          { error: "Name cannot be empty" },
          { status: 400 }
        );
      }

      updateData.name = body.name.trim();
    }

    if (hasOwn(body, "email")) {
      const email = normalizeOptionalString(body.email);
      if (email === undefined) {
        return NextResponse.json(
          { error: "Email must be a string" },
          { status: 400 }
        );
      }

      if (email) {
        const existingEmail = await prisma.user.findFirst({
          where: {
            tenantId,
            email: { equals: email, mode: "insensitive" },
            NOT: { id },
          },
          select: { id: true },
        });

        if (existingEmail) {
          return NextResponse.json(
            { error: "A user with this email already exists" },
            { status: 409 }
          );
        }
      }

      updateData.email = email;
    }

    if (hasOwn(body, "phone")) {
      const phone = normalizeOptionalString(body.phone);
      if (!phone) {
        return NextResponse.json(
          { error: "Phone is required" },
          { status: 400 }
        );
      }

      const existingPhone = await prisma.user.findFirst({
        where: {
          tenantId,
          phone,
          NOT: { id },
        },
        select: { id: true },
      });

      if (existingPhone) {
        return NextResponse.json(
          { error: "A user with this phone already exists" },
          { status: 409 }
        );
      }

      updateData.phone = phone;
    }

    if (hasOwn(body, "userRole")) {
      if (
        typeof body.userRole !== "string" ||
        !VALID_ROLES.has(body.userRole as Role)
      ) {
        return NextResponse.json(
          { error: "Invalid user role" },
          { status: 400 }
        );
      }

      updateData.role = body.userRole;
    }

    if (hasOwn(body, "isActive")) {
      if (typeof body.isActive !== "boolean") {
        return NextResponse.json(
          { error: "isActive must be a boolean" },
          { status: 400 }
        );
      }

      updateData.isActive = body.isActive;
    }

    if (hasOwn(body, "password")) {
      if (typeof body.password !== "string" || body.password.length < 6) {
        return NextResponse.json(
          { error: "Password must be at least 6 characters" },
          { status: 400 }
        );
      }

      updateData.password = await hashPassword(body.password);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] - Soft delete (Admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  try {
    const { id } = await params;
    const existingUser = await prisma.user.findFirst({
      where: {
        id,
        tenantId,
      },
      select: { id: true },
    });
    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
