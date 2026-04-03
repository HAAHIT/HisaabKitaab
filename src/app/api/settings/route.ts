import { NextResponse } from "next/server";
import { serializeCompanySettings } from "@/lib/media";
import { prisma } from "@/lib/prisma";

// GET /api/settings - Get company settings
export async function GET() {
  try {
    const settings = await prisma.companySettings.findUnique({
      where: { id: "default" },
      include: {
        companyLogoAsset: {
          select: { id: true },
        },
      },
    });

    return NextResponse.json({ settings: serializeCompanySettings(settings) });
  } catch {
    return NextResponse.json({ settings: null });
  }
}

// PATCH /api/settings - Update company settings
export async function PATCH(request: Request) {
  const role = request.headers.get("x-user-role");
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = {
      companyName:
        typeof body.companyName === "string" ? body.companyName.trim() : "",
      companyAddress:
        typeof body.companyAddress === "string" ? body.companyAddress.trim() : "",
      companyPhone:
        typeof body.companyPhone === "string" ? body.companyPhone.trim() : "",
      companyEmail:
        typeof body.companyEmail === "string" ? body.companyEmail.trim() : "",
      companyGstin:
        typeof body.companyGstin === "string" ? body.companyGstin.trim() : "",
      defaultTaxPercent:
        typeof body.defaultTaxPercent === "number" ? body.defaultTaxPercent : 0,
      defaultTerms:
        typeof body.defaultTerms === "string" ? body.defaultTerms.trim() : "",
      billPrefix:
        typeof body.billPrefix === "string" && body.billPrefix.trim()
          ? body.billPrefix.trim()
          : "BILL",
    };

    const settings = await prisma.companySettings.upsert({
      where: { id: "default" },
      update: data,
      create: { id: "default", ...data },
      include: {
        companyLogoAsset: {
          select: { id: true },
        },
      },
    });

    return NextResponse.json({ settings: serializeCompanySettings(settings) });
  } catch (error) {
    console.error("Update settings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
