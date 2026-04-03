import { NextRequest, NextResponse } from "next/server";
import {
  buildMediaAssetCreateInputFromFile,
  buildMediaAssetCreateInputFromLegacyUrl,
  deleteMediaAsset,
  extractLegacyPhotoUrl,
  serializeMeasurementUpload,
} from "@/lib/media";
import { findUniqueCustomerPartyIdForUser } from "@/lib/party-relations";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function parseOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function readMeasurementPayload(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    return {
      label: parseOptionalString(formData.get("label")),
      roomName: parseOptionalString(formData.get("roomName")),
      doorType: parseOptionalString(formData.get("doorType")),
      notes: parseOptionalString(formData.get("notes")),
      partyId: parseOptionalString(formData.get("partyId")),
      files: formData
        .getAll("photos")
        .filter((entry): entry is File => entry instanceof File && entry.size > 0),
      legacyPhotoUrls: [] as string[],
    };
  }

  const body = await request.json();
  return {
    label: parseOptionalString(body.label),
    roomName: parseOptionalString(body.roomName),
    doorType: parseOptionalString(body.doorType),
    notes: parseOptionalString(body.notes),
    partyId: parseOptionalString(body.partyId),
    files: [] as File[],
    legacyPhotoUrls: Array.isArray(body.photos)
      ? body.photos
          .map((entry: unknown) => extractLegacyPhotoUrl(entry))
          .filter((entry: string | null): entry is string => Boolean(entry))
      : [],
  };
}

async function buildPhotoAssetInputs({
  files,
  legacyPhotoUrls,
}: {
  files: File[];
  legacyPhotoUrls: string[];
}) {
  const assets: Array<
    Awaited<ReturnType<typeof buildMediaAssetCreateInputFromFile>>
  > = [];

  try {
    if (files.length > 0) {
      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          throw new Error("All uploaded files must be images");
        }

        if (file.size > 8 * 1024 * 1024) {
          throw new Error("Each photo must be smaller than 8MB");
        }

        assets.push(
          await buildMediaAssetCreateInputFromFile({
            file,
            kind: "MEASUREMENT_PHOTO",
            namespace: "measurement-photos",
          })
        );
      }

      return assets;
    }

    for (let index = 0; index < legacyPhotoUrls.length; index += 1) {
      assets.push(
        await buildMediaAssetCreateInputFromLegacyUrl({
          url: legacyPhotoUrls[index],
          kind: "MEASUREMENT_PHOTO",
          namespace: "measurement-photos",
          originalName: `measurement-${index + 1}`,
        })
      );
    }

    return assets;
  } catch (error) {
    await Promise.all(
      assets.map((asset) => deleteMediaAsset(asset).catch(() => undefined))
    );
    throw error;
  }
}

const measurementInclude = {
  customer: { select: { name: true, phone: true } },
  party: { select: { id: true, name: true, type: true } },
  photoAssets: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      sortOrder: true,
      asset: {
        select: { id: true },
      },
    },
  },
};

// GET /api/measurements - List measurements with filters
export async function GET(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  const userId = request.headers.get("x-user-id");

  if (!role || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "ALL";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    isDeleted: false,
  };

  if (role === "CUSTOMER") {
    where.customerId = userId;
  }

  if (status !== "ALL") {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { label: { contains: search, mode: "insensitive" } },
      { roomName: { contains: search, mode: "insensitive" } },
      { doorType: { contains: search, mode: "insensitive" } },
      { customer: { name: { contains: search, mode: "insensitive" } } },
      { party: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const measurements = await prisma.measurementUpload.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: measurementInclude,
  });

  return NextResponse.json({
    measurements: measurements.map((measurement) =>
      serializeMeasurementUpload(measurement)
    ),
  });
}

// POST /api/measurements - Upload a measurement with photo assets
export async function POST(request: NextRequest) {
  const userId = request.headers.get("x-user-id");

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let photoAssets: Array<
    Awaited<ReturnType<typeof buildMediaAssetCreateInputFromFile>>
  > = [];

  try {
    const payload = await readMeasurementPayload(request);
    const label = payload.label;

    if (!label) {
      return NextResponse.json({ error: "Label is required" }, { status: 400 });
    }

    let resolvedPartyId: string | null = null;

    if (payload.partyId) {
      const party = await prisma.party.findFirst({
        where: {
          id: payload.partyId,
          type: "CUSTOMER",
          isDeleted: false,
          isActive: true,
        },
        select: { id: true },
      });

      if (!party) {
        return NextResponse.json({ error: "Party not found" }, { status: 404 });
      }

      resolvedPartyId = party.id;
    } else {
      resolvedPartyId = await findUniqueCustomerPartyIdForUser(prisma, userId);
    }

    photoAssets = await buildPhotoAssetInputs(payload);
    if (photoAssets.length === 0) {
      return NextResponse.json(
        { error: "At least one photo is required" },
        { status: 400 }
      );
    }

    const measurement = await prisma.$transaction(async (tx) => {
      for (const asset of photoAssets) {
        await tx.mediaAsset.create({ data: asset });
      }

      return tx.measurementUpload.create({
        data: {
          customerId: userId,
          partyId: resolvedPartyId ?? undefined,
          label,
          roomName: payload.roomName ?? undefined,
          doorType: payload.doorType ?? undefined,
          notes: payload.notes ?? undefined,
          photosLegacy: [],
          status: "UPLOADED",
          photoAssets: {
            create: photoAssets.map((asset, index) => ({
              sortOrder: index,
              assetId: asset.id,
            })),
          },
        },
        include: measurementInclude,
      });
    });

    return NextResponse.json(
      { measurement: serializeMeasurementUpload(measurement) },
      { status: 201 }
    );
  } catch (error) {
    await Promise.all(
      photoAssets.map((asset) => deleteMediaAsset(asset).catch(() => undefined))
    );

    const message =
      error instanceof Error ? error.message : "Internal server error";
    const status =
      error instanceof Error && message !== "Internal server error" ? 400 : 500;

    console.error("Create measurement error:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
