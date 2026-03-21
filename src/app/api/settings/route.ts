import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/settings — Get company settings
export async function GET() {
  try {
    const settings = await prisma.companySettings.findUnique({
      where: { id: "default" },
    });
    return NextResponse.json({ settings: settings || null });
  } catch {
    return NextResponse.json({ settings: null });
  }
}

// PATCH /api/settings — Update company settings
export async function PATCH(request: Request) {
  const role = request.headers.get("x-user-role");
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const settings = await prisma.companySettings.upsert({
      where: { id: "default" },
      update: body,
      create: { id: "default", ...body },
    });
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Update settings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
