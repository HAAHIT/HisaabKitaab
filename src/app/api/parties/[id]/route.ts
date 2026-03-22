import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

async function findVisibleParty(id: string) {
  return prisma.party.findFirst({
    where: {
      id,
      isDeleted: false,
    },
    include: {
      payments: {
        where: { isDeleted: false },
        orderBy: { date: "desc" },
        take: 20,
      },
    },
  });
}

// GET /api/parties/[id] - Get single party with payment history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = request.headers.get("x-user-role");
  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const party = await findVisibleParty(id);

  if (!party) {
    return NextResponse.json({ error: "Party not found" }, { status: 404 });
  }

  return NextResponse.json({ party });
}

// PATCH /api/parties/[id] - Update party
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = request.headers.get("x-user-role");
  if (!role || role === "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const existingParty = await findVisibleParty(id);

    if (!existingParty) {
      return NextResponse.json({ error: "Party not found" }, { status: 404 });
    }

    const party = await prisma.party.update({
      where: { id },
      data: body,
    });

    return NextResponse.json({ party });
  } catch (error) {
    console.error("Update party error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/parties/[id] - Soft delete
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
    const existingParty = await findVisibleParty(id);

    if (!existingParty) {
      return NextResponse.json({ error: "Party not found" }, { status: 404 });
    }

    await prisma.party.update({
      where: { id },
      data: {
        isActive: false,
        isDeleted: true,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete party error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
