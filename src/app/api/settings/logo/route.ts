import { NextResponse, NextRequest } from "next/server";
import {
  buildMediaAssetCreateInputFromFile,
  deleteMediaAsset,
} from "@/lib/media";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";

function isAdmin(request: Request) {
  return request.headers.get("x-user-role") === "ADMIN";
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let nextAsset:
    | Awaited<ReturnType<typeof buildMediaAssetCreateInputFromFile>>
    | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Logo file is required" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Logo must be an image" }, { status: 400 });
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Logo must be smaller than 2MB" },
        { status: 400 }
      );
    }

    nextAsset = await buildMediaAssetCreateInputFromFile({
      file,
      kind: "COMPANY_LOGO",
      namespace: "company-logos",
    });

    const tenantId = await getTenantId();

    const previousTenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { logoUrl: true },
    });

    const asset = await prisma.mediaAsset.create({ data: nextAsset! });

    // Update the logo URL on the tenant
    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        logoUrl: `/api/assets/${asset.id}`,
      },
    });

    // Best effort cleanup of previous logo if it was a media asset
    if (previousTenant?.logoUrl && previousTenant.logoUrl.startsWith("/api/assets/")) {
      const oldId = previousTenant.logoUrl.replace("/api/assets/", "");
      const oldAsset = await prisma.mediaAsset.findUnique({ where: { id: oldId } });
      if (oldAsset) {
        await prisma.mediaAsset.delete({ where: { id: oldId } });
        await deleteMediaAsset(oldAsset);
      }
    }

    // Reconstruct settings for response
    const s = (updatedTenant.settings as Record<string, unknown>) || {};
    const settings = {
        companyName: (s.companyName as string) || updatedTenant.name || "",
        companyAddress: (s.companyAddress as string) || updatedTenant.address || "",
        companyPhone: (s.companyPhone as string) || updatedTenant.phone || "",
        companyEmail: (s.companyEmail as string) || updatedTenant.email || "",
        companyGstin: (s.companyGstin as string) || updatedTenant.gstin || "",
        defaultTaxPercent: (s.defaultTaxPercent as number) ?? 18,
        defaultTerms: (s.defaultTerms as string) || "",
        billPrefix: (s.billPrefix as string) || "BILL",
        upiId: (s.upiId as string) || "",
        companyLogoUrl: updatedTenant.logoUrl || null,
    };

    return NextResponse.json({ settings });
  } catch (error) {
    if (nextAsset) {
      await deleteMediaAsset(nextAsset).catch(() => undefined);
    }

    console.error("Upload logo error:", error);
    return NextResponse.json(
      { error: "Failed to upload logo" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const tenantId = await getTenantId();
    const previousTenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { logoUrl: true },
    });

    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        logoUrl: null,
      },
    });

    // Cleanup
    if (previousTenant?.logoUrl && previousTenant.logoUrl.startsWith("/api/assets/")) {
      const oldId = previousTenant.logoUrl.replace("/api/assets/", "");
      const oldAsset = await prisma.mediaAsset.findUnique({ where: { id: oldId } });
      if (oldAsset) {
        await prisma.mediaAsset.delete({ where: { id: oldId } });
        await deleteMediaAsset(oldAsset);
      }
    }

    // Reconstruct settings for response
    const s = (updatedTenant.settings as Record<string, unknown>) || {};
    const settings = {
        companyName: (s.companyName as string) || updatedTenant.name || "",
        companyAddress: (s.companyAddress as string) || updatedTenant.address || "",
        companyPhone: (s.companyPhone as string) || updatedTenant.phone || "",
        companyEmail: (s.companyEmail as string) || updatedTenant.email || "",
        companyGstin: (s.companyGstin as string) || updatedTenant.gstin || "",
        defaultTaxPercent: (s.defaultTaxPercent as number) ?? 18,
        defaultTerms: (s.defaultTerms as string) || "",
        billPrefix: (s.billPrefix as string) || "BILL",
        upiId: (s.upiId as string) || "",
        companyLogoUrl: updatedTenant.logoUrl || null,
    };

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Delete logo error:", error);
    return NextResponse.json(
      { error: "Failed to delete logo" },
      { status: 500 }
    );
  }
}
