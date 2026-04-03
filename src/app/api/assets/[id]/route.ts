import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readStoredObject } from "@/lib/object-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role");

  if (!userId || !role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const asset = await prisma.mediaAsset.findUnique({
    where: { id },
    select: {
      kind: true,
      storageProvider: true,
      storageKey: true,
      mimeType: true,
      measurementPhotos: {
        select: {
          measurement: {
            select: {
              customerId: true,
            },
          },
        },
        take: 1,
      },
    },
  });

  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (
    role === "CUSTOMER" &&
    asset.kind === "MEASUREMENT_PHOTO" &&
    !asset.measurementPhotos.some(
      (photo) => photo.measurement.customerId === userId
    )
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (asset.storageProvider === "proxy") {
    return NextResponse.redirect(asset.storageKey);
  }

  try {
    const fileBuffer = await readStoredObject(
      asset.storageProvider as "local" | "gcs",
      asset.storageKey
    );
    return new NextResponse(fileBuffer as any, {
      headers: {
        "Content-Type": asset.mimeType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }
}

