import { NextResponse } from "next/server";
import {
  buildMediaAssetCreateInputFromFile,
  deleteMediaAsset,
} from "@/lib/media";
import { prisma } from "@/lib/prisma";
import {
  resolveTenantIdFromRequest,
  TENANT_CONTEXT_MISSING_MESSAGE,
} from "@/lib/tenant";

export const runtime = "nodejs";

type TenantLogoRow = {
  id: string;
  logoUrl: string | null;
  createdAt: Date;
};

async function findTenantLogoRow(request: Request): Promise<TenantLogoRow | null> {
  const tenantId = resolveTenantIdFromRequest(request);
  if (!tenantId) {
    return null;
  }

  const scoped = await prisma.$queryRaw<TenantLogoRow[]>`
    SELECT "id", "logoUrl", "createdAt"
    FROM "Tenant"
    WHERE "id" = ${tenantId}
    LIMIT 1
  `;

  return scoped[0] || null;
}

function extractAssetIdFromLogoUrl(url: string | null) {
  if (!url) {
    return null;
  }

  const match = url.match(/\/api\/assets\/([^/?#]+)/);
  return match?.[1] || null;
}

async function deleteAssetById(assetId: string | null) {
  if (!assetId) {
    return;
  }

  const existingAsset = await prisma.mediaAsset.findUnique({
    where: { id: assetId },
  });

  if (!existingAsset) {
    return;
  }

  await prisma.mediaAsset.delete({
    where: { id: existingAsset.id },
  });
  await deleteMediaAsset(existingAsset);
}

function isAdmin(request: Request) {
  return request.headers.get("x-user-role") === "ADMIN";
}

export async function POST(request: Request) {
  const tenantId = resolveTenantIdFromRequest(request);
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: TENANT_CONTEXT_MISSING_MESSAGE },
      { status: 500 }
    );
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

    const tenant = await findTenantLogoRow(request);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const previousAssetId = extractAssetIdFromLogoUrl(tenant.logoUrl);
    const nextLogoUrl = `/api/assets/${nextAsset.id}`;

    const updatedTenantRows = await prisma.$transaction(async (tx) => {
      await tx.mediaAsset.create({ data: nextAsset! });

      return tx.$queryRaw<TenantLogoRow[]>`
        UPDATE "Tenant"
        SET
          "logoUrl" = ${nextLogoUrl},
          "updatedAt" = NOW()
        WHERE "id" = ${tenant.id}
        RETURNING "id", "logoUrl", "createdAt"
      `;
    });

    const updatedTenant = updatedTenantRows[0];
    if (!updatedTenant) {
      throw new Error("Failed to update tenant logo");
    }

    if (previousAssetId && previousAssetId !== nextAsset.id) {
      await deleteAssetById(previousAssetId).catch(() => undefined);
    }

    return NextResponse.json({
      settings: {
        companyLogo: updatedTenant.logoUrl,
      },
    });
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

export async function DELETE(request: Request) {
  const tenantId = resolveTenantIdFromRequest(request);
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: TENANT_CONTEXT_MISSING_MESSAGE },
      { status: 500 }
    );
  }

  try {
    const tenant = await findTenantLogoRow(request);
    if (!tenant) {
      return NextResponse.json({ settings: { companyLogo: null } });
    }

    const previousAssetId = extractAssetIdFromLogoUrl(tenant.logoUrl);
    const updatedTenantRows = await prisma.$queryRaw<TenantLogoRow[]>`
      UPDATE "Tenant"
      SET
        "logoUrl" = NULL,
        "updatedAt" = NOW()
      WHERE "id" = ${tenant.id}
      RETURNING "id", "logoUrl", "createdAt"
    `;

    await deleteAssetById(previousAssetId).catch(() => undefined);

    return NextResponse.json({
      settings: {
        companyLogo: updatedTenantRows[0]?.logoUrl ?? null,
      },
    });
  } catch (error) {
    console.error("Delete logo error:", error);
    return NextResponse.json(
      { error: "Failed to delete logo" },
      { status: 500 }
    );
  }
}
