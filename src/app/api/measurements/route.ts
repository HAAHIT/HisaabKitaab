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
import { resolveReadTenant, resolveWriteTenant } from "@/lib/api-tenant";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { logError, getRequestId } from "@/lib/observability";
import type { MeasurementStatus, Prisma } from "@prisma/client";

export const runtime = "nodejs";

type MeasurementPhotoAssetCreateInput = Prisma.MediaAssetCreateInput & {
  id: string;
};
const VALID_MEASUREMENT_STATUSES = new Set<MeasurementStatus>([
  "UPLOADED",
  "PENDING",
  "REVIEWED",
  "IN_PRODUCTION",
  "COMPLETED",
]);

function isMeasurementStatus(value: string): value is MeasurementStatus {
  return VALID_MEASUREMENT_STATUSES.has(value as MeasurementStatus);
}

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
      itemType: parseOptionalString(formData.get("itemType") || formData.get("doorType")),
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
    itemType: parseOptionalString(body.itemType || body.doorType),
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

// Validate file contents by magic bytes
async function isValidImageFile(file: File): Promise<boolean> {
  const buffer = await file.slice(0, 12).arrayBuffer();
  const b = new Uint8Array(buffer);

  const isJpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const isPng =
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const isGif =
    b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38;
  const isWebp =
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50;

  return isJpeg || isPng || isGif || isWebp;
}

async function buildPhotoAssetInputs({
  files,
  legacyPhotoUrls,
}: {
  files: File[];
  legacyPhotoUrls: string[];
}) {
  const assets: MeasurementPhotoAssetCreateInput[] = [];

  try {
    if (files.length > 0) {
      for (const file of files) {
        if (!(await isValidImageFile(file))) {
          throw new Error("All uploaded files must be valid images");
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
  const tenantResolution = await resolveReadTenant(request);
  if (!tenantResolution.ok) {
    return tenantResolution.response;
  }
  const tenantId = tenantResolution.tenantId;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "ALL";

  const where: Prisma.MeasurementUploadWhereInput = {
    isDeleted: false,
    tenantId,
  };

  if (role === "CUSTOMER") {
    where.customerId = userId;
  }

  if (status !== "ALL" && isMeasurementStatus(status)) {
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
  const rateLimitResponse = await checkRateLimit(request, "measurements.upload", 20);
  if (rateLimitResponse) return rateLimitResponse;

  const userId = request.headers.get("x-user-id");

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tenantResolution = await resolveWriteTenant(request);
  if (!tenantResolution.ok) {
    return tenantResolution.response;
  }
  const tenantId = tenantResolution.tenantId;

  let photoAssets: MeasurementPhotoAssetCreateInput[] = [];

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
          tenantId,
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
      resolvedPartyId = await findUniqueCustomerPartyIdForUser(
        prisma,
        userId,
        tenantId
      );
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

      const createdMeasurement = await tx.measurementUpload.create({
        data: {
          tenantId,
          customerId: userId!,
          partyId: resolvedPartyId,
          label: label!,
          roomName: payload.roomName,
          doorType: payload.itemType,
          notes: payload.notes,
          photosLegacy: [],
          status: "UPLOADED",
          isDeleted: false,
          photoAssets: {
            create: photoAssets.map((asset, index) => ({
              assetId: asset.id,
              sortOrder: index,
            })),
          },
        },
        include: measurementInclude,
      });

      return createdMeasurement;
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

    logError("measurements.create.error", { requestId: getRequestId(request), error });
    return NextResponse.json({ error: message }, { status });
  }
}
