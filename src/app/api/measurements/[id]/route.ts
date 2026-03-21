import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/measurements/[id] — Get single measurement
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = request.headers.get("x-user-role");
  const userId = request.headers.get("x-user-id");

  if (!role || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const measurement = await prisma.measurementUpload.findUnique({
    where: { id },
    include: {
      customer: { select: { name: true, phone: true, email: true } },
    },
  });

  if (!measurement) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Ensure security: Customers can only see their own
  if (role === "CUSTOMER" && measurement.customerId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ measurement });
}

// PATCH /api/measurements/[id] — Update measurement status (Staff/Admin)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = request.headers.get("x-user-role");
  const userId = request.headers.get("x-user-id");

  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { status, reviewNotes } = body;

    const data: Record<string, unknown> = {
      status,
      reviewNotes: reviewNotes || null,
      reviewedBy: userId,
    };

    const measurement = await prisma.measurementUpload.update({
      where: { id },
      data,
    });

    return NextResponse.json({ measurement });
  } catch (error) {
    console.error("Update measurement error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/measurements/[id] — Delete measurement (Admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = request.headers.get("x-user-role");

  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    await prisma.measurementUpload.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete measurement error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
