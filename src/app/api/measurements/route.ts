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
import {
  resolveTenantIdFromRequest,
  TENANT_CONTEXT_MISSING_MESSAGE,
} from "@/lib/tenant";

export const runtime = "nodejs";

type MeasurementPhotoAssetCreateInput =
  | Awaited<ReturnType<typeof buildMediaAssetCreateInputFromFile>>
  | Awaited<ReturnType<typeof buildMediaAssetCreateInputFromLegacyUrl>>;

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
      itemType: parseOptionalString(formData.get("itemType")),
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
    itemType: parseOptionalString(body.itemType),
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
  const assets: MeasurementPhotoAssetCreateInput[] = [];

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
  const tenantId = resolveTenantIdFromRequest(request);

  if (!role || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: TENANT_CONTEXT_MISSING_MESSAGE },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "ALL";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    isDeleted: false,
    tenantId,
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
      { itemType: { contains: search, mode: "insensitive" } },
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
  const tenantId = resolveTenantIdFromRequest(request);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: TENANT_CONTEXT_MISSING_MESSAGE },
      { status: 500 }
    );
  }

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

      const measurementId = crypto.randomUUID();
      await tx.$executeRaw`
        INSERT INTO "MeasurementUpload" (
          "id",
          "tenantId",
          "customerId",
          "partyId",
          "label",
          "roomName",
          "itemType",
          "notes",
          "photos",
          "status",
          "isDeleted",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${measurementId},
          ${tenantId},
          ${userId},
          ${resolvedPartyId},
          ${label},
          ${payload.roomName},
          ${payload.itemType},
          ${payload.notes},
          ${JSON.stringify([])}::jsonb,
          'UPLOADED'::"MeasurementStatus",
          false,
          NOW(),
          NOW()
        )
      `;

      await tx.measurementPhoto.createMany({
        data: photoAssets.map((asset, index) => ({
          measurementId,
          assetId: asset.id,
          sortOrder: index,
        })),
      });

      const createdMeasurement = await tx.measurementUpload.findUnique({
        where: { id: measurementId },
        include: measurementInclude,
      });

      if (!createdMeasurement) {
        throw new Error("Failed to create measurement");
      }

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

    console.error("Create measurement error:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
