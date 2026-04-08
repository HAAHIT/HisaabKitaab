import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { resolveWriteTenant } from "@/lib/api-tenant";
import { logError, getRequestId } from "@/lib/observability";

export const runtime = "nodejs";

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

/**
 * Update an existing user for the resolved tenant; only accessible to admins.
 *
 * Validates and applies any of: name, email (nullable, unique per tenant, case-insensitive), phone (required, unique per tenant), userRole (must be a valid Role), isActive, and password (hashed). Rejects requests when the requester is not an admin, the tenant cannot be resolved, the target user does not exist, or validation/uniqueness checks fail.
 *
 * @param request - Incoming Next.js request object containing headers and JSON body
 * @param params - Route parameters promise resolving to an object with `id` (the user id to update)
 * @returns The HTTP JSON response: on success `{ user }` with the updated user fields; on error an `{ error }` message with an appropriate status code (403, 404, 400, 409, or 500)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = request.headers.get("x-user-role");

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantResolution = await resolveWriteTenant(request);
  if (!tenantResolution.ok) {
    return tenantResolution.response;
  }
  const tenantId = tenantResolution.tenantId;

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
    logError("users.update.error", { requestId: getRequestId(request), error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Soft-deletes a user by setting `isActive` to `false` for an admin-scoped request within the resolved tenant.
 *
 * @param request - Incoming Next.js request; must include `x-user-role: ADMIN` header.
 * @param params - Route parameters object containing `id`, the user identifier to soft-delete.
 * @returns A JSON response:
 * - `200` with `{ success: true }` when the user was soft-deleted.
 * - `403` with `{ error: "Forbidden" }` when the requester is not an admin.
 * - `404` with `{ error: "User not found" }` when no user with the given `id` exists in the resolved tenant.
 * - `500` with `{ error: "Internal server error" }` on unexpected failures.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = request.headers.get("x-user-role");

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantResolution = await resolveWriteTenant(request);
  if (!tenantResolution.ok) {
    return tenantResolution.response;
  }
  const tenantId = tenantResolution.tenantId;

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
    logError("users.delete.error", { requestId: getRequestId(request), error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
