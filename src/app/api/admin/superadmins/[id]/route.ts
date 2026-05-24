import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logError, getRequestId } from "@/lib/observability";
import { resolveSuperAdminSession } from "@/lib/session-server";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await resolveSuperAdminSession(request);
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  if (id === session.userId) {
    return NextResponse.json({ error: "Cannot revoke yourself" }, { status: 400 });
  }

  try {
    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!target || target.role !== "SUPERADMIN") {
      return NextResponse.json({ error: "Not a superadmin" }, { status: 404 });
    }
    // Soft revoke: drop role to ADMIN + deactivate. Avoids hard-deleting a User
    // row that may be referenced by Bill.createdBy, Payment.createdBy, etc.
    await prisma.user.update({
      where: { id },
      data: { role: "ADMIN", isActive: false },
    });
    return NextResponse.json({ data: { id, revoked: true } });
  } catch (error) {
    logError("admin.superadmins.revoke.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
