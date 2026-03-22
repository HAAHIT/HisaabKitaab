import { NextResponse } from "next/server";
import {
  buildMediaAssetCreateInputFromFile,
  deleteMediaAsset,
  serializeCompanySettings,
} from "@/lib/media";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function isAdmin(request: Request) {
  return request.headers.get("x-user-role") === "ADMIN";
}

export async function POST(request: Request) {
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

    const currentSettings = await prisma.companySettings.findUnique({
      where: { id: "default" },
      include: {
        companyLogoAsset: true,
      },
    });

    const settings = await prisma.$transaction(async (tx) => {
      await tx.mediaAsset.create({ data: nextAsset! });

      return tx.companySettings.upsert({
        where: { id: "default" },
        update: {
          companyLogoAssetId: nextAsset!.id,
          companyLogoLegacy: null,
        },
        create: {
          id: "default",
          companyLogoAssetId: nextAsset!.id,
        },
        include: {
          companyLogoAsset: {
            select: { id: true },
          },
        },
      });
    });

    if (currentSettings?.companyLogoAsset) {
      await prisma.mediaAsset.delete({
        where: { id: currentSettings.companyLogoAsset.id },
      });
      await deleteMediaAsset(currentSettings.companyLogoAsset);
    }

    return NextResponse.json({ settings: serializeCompanySettings(settings) });
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
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const currentSettings = await prisma.companySettings.findUnique({
      where: { id: "default" },
      include: {
        companyLogoAsset: true,
      },
    });

    const settings = await prisma.companySettings.upsert({
      where: { id: "default" },
      update: {
        companyLogoAssetId: null,
        companyLogoLegacy: null,
      },
      create: {
        id: "default",
      },
      include: {
        companyLogoAsset: {
          select: { id: true },
        },
      },
    });

    if (currentSettings?.companyLogoAsset) {
      await prisma.mediaAsset.delete({
        where: { id: currentSettings.companyLogoAsset.id },
      });
      await deleteMediaAsset(currentSettings.companyLogoAsset);
    }

    return NextResponse.json({ settings: serializeCompanySettings(settings) });
  } catch (error) {
    console.error("Delete logo error:", error);
    return NextResponse.json(
      { error: "Failed to delete logo" },
      { status: 500 }
    );
  }
}
