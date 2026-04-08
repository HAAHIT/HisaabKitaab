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

/**
 * Determines whether a string is one of the allowed measurement status values.
 *
 * Acts as a type guard for `MeasurementStatus`.
 *
 * @returns `true` if `value` is one of the allowed measurement status strings, `false` otherwise.
 */
function isMeasurementStatus(value: string): value is MeasurementStatus {
  return VALID_MEASUREMENT_STATUSES.has(value as MeasurementStatus);
}

/**
 * Produce a trimmed string when the input is a non-empty string.
 *
 * @param value - The value to normalize into a trimmed string
 * @returns The trimmed string if `value` is a non-empty string, `null` otherwise
 */
function parseOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Parses the incoming request and extracts measurement metadata and photo inputs.
 *
 * @param request - The HTTP request whose body may be multipart/form-data or JSON
 * @returns An object with the extracted fields:
 *  - `label`: trimmed string or `null` if not provided or empty
 *  - `roomName`: trimmed string or `null`
 *  - `itemType`: trimmed string from `itemType` or fallback `doorType`, or `null`
 *  - `notes`: trimmed string or `null`
 *  - `partyId`: trimmed string or `null`
 *  - `files`: array of uploaded `File` objects (only entries that are `File` instances with size > 0)
 *  - `legacyPhotoUrls`: array of legacy photo URL strings (populated when JSON `photos` are provided)
 */
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

/**
 * Checks whether a File's initial bytes match supported image format signatures.
 *
 * @param file - The file to inspect for image "magic bytes"; supported formats: JPEG, PNG, GIF, WebP.
 * @returns `true` if the file matches one of the supported image formats, `false` otherwise.
 */
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

/**
 * Builds media-asset create inputs for measurement photos from either uploaded files or legacy URLs.
 *
 * Validates that each uploaded file is a supported image and no larger than 8 MB. If `files` is non-empty,
 * an input is created for each file; otherwise inputs are created from `legacyPhotoUrls`. If an error
 * occurs after some inputs have been created, those partial assets are deleted before the error is re-thrown.
 *
 * @param files - Uploaded File objects (preferred source of photo assets)
 * @param legacyPhotoUrls - Fallback photo URLs used when `files` is empty
 * @returns An array of `MeasurementPhotoAssetCreateInput` ready for persistence
 * @throws Error with message "All uploaded files must be valid images" when a file is not a supported image
 * @throws Error with message "Each photo must be smaller than 8MB" when a file exceeds the size limit
 */
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

/**
 * List measurement uploads for the resolved tenant and requesting user, applying optional search and status filters.
 *
 * @returns An object with `measurements`: an array of serialized measurement uploads matching the query
 */
export async function GET(request: NextRequest) {
  const role = request.headers.get("x-user-role");
  const userId = request.headers.get("x-user-id");

  if (!role || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tenantResolution = resolveReadTenant(request);
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

/**
 * Create a measurement upload with associated photo media assets for the current tenant.
 *
 * Validates the request payload and uploaded images, enforces rate limits and write-tenant permissions, creates media assets and the measurement record in a transaction, and attempts cleanup of any created media assets if an error occurs.
 *
 * @returns A NextResponse containing the created measurement (status 201) on success, or a JSON error object with an appropriate HTTP status code on failure.
 */
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
