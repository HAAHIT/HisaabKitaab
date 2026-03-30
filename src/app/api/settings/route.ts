import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/tenant";

// GET /api/settings - Get company settings from Tenant record
export async function GET() {
  try {
    const tenantId = await getTenantId();
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        gstin: true,
        logoUrl: true,
        settings: true,
      },
    });

    if (!tenant) {
      return NextResponse.json({ settings: null });
    }

    const s = (tenant.settings as Record<string, unknown>) || {};

    // Serialize into the shape the frontend expects (matching old CompanySettings shape)
    const settings = {
      companyName: (s.companyName as string) || tenant.name || "",
      companyAddress: (s.companyAddress as string) || tenant.address || "",
      companyPhone: (s.companyPhone as string) || tenant.phone || "",
      companyEmail: (s.companyEmail as string) || tenant.email || "",
      companyGstin: (s.companyGstin as string) || tenant.gstin || "",
      defaultTaxPercent: (s.defaultTaxPercent as number) ?? 18,
      defaultTerms: (s.defaultTerms as string) || "",
      billPrefix: (s.billPrefix as string) || "BILL",
      upiId: (s.upiId as string) || "",
      companyLogoUrl: tenant.logoUrl || null,
    };

    return NextResponse.json({ settings });
  } catch {
    return NextResponse.json({ settings: null });
  }
}

// PATCH /api/settings - Update company settings in Tenant.settings JSON
export async function PATCH(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const tenantId = await getTenantId();
    const body = await request.json();

    const newSettings = {
      companyName:
        typeof body.companyName === "string" ? body.companyName.trim() : "",
      companyAddress:
        typeof body.companyAddress === "string"
          ? body.companyAddress.trim()
          : "",
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
      upiId: typeof body.upiId === "string" ? body.upiId.trim() : "",
    };

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        // Also update top-level tenant fields for index/search purposes
        name: newSettings.companyName || undefined,
        phone: newSettings.companyPhone || undefined,
        email: newSettings.companyEmail || undefined,
        address: newSettings.companyAddress || undefined,
        gstin: newSettings.companyGstin || undefined,
        settings: newSettings,
      },
    });

    const s = (tenant.settings as Record<string, unknown>) || {};
    const settings = {
      companyName: (s.companyName as string) || tenant.name || "",
      companyAddress: (s.companyAddress as string) || tenant.address || "",
      companyPhone: (s.companyPhone as string) || tenant.phone || "",
      companyEmail: (s.companyEmail as string) || tenant.email || "",
      companyGstin: (s.companyGstin as string) || tenant.gstin || "",
      defaultTaxPercent: (s.defaultTaxPercent as number) ?? 18,
      defaultTerms: (s.defaultTerms as string) || "",
      billPrefix: (s.billPrefix as string) || "BILL",
      upiId: (s.upiId as string) || "",
      companyLogoUrl: tenant.logoUrl || null,
    };

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Update settings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
