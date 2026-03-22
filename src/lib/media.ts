import { randomUUID } from "crypto";
import type { MediaAssetKind } from "@prisma/client";
import {
  deleteStoredObject,
  storeBuffer,
  type StorageNamespace,
} from "@/lib/object-storage";

type AssetIdRef = {
  id: string;
};

function getMediaMimeTypeFromUrl(value: string) {
  const lowered = value.toLowerCase();
  if (lowered.endsWith(".jpg") || lowered.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lowered.endsWith(".png")) {
    return "image/png";
  }
  if (lowered.endsWith(".webp")) {
    return "image/webp";
  }
  if (lowered.endsWith(".gif")) {
    return "image/gif";
  }
  if (lowered.endsWith(".svg")) {
    return "image/svg+xml";
  }
  return "application/octet-stream";
}

function getAssetUrl(assetId: string) {
  return `/api/assets/${assetId}`;
}

export function isDataUrl(value: string) {
  return value.startsWith("data:");
}

export function extractLegacyPhotoUrl(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (
    value &&
    typeof value === "object" &&
    "url" in value &&
    typeof value.url === "string" &&
    value.url.trim()
  ) {
    return value.url.trim();
  }

  return null;
}

export function parseLegacyPhotos(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry === "string" && entry.trim()) {
        return { url: entry.trim() };
      }

      if (
        entry &&
        typeof entry === "object" &&
        "url" in entry &&
        typeof entry.url === "string" &&
        entry.url.trim()
      ) {
        return {
          url: entry.url.trim(),
          thumbnailUrl:
            "thumbnailUrl" in entry && typeof entry.thumbnailUrl === "string"
              ? entry.thumbnailUrl
              : undefined,
        };
      }

      return null;
    })
    .filter((entry): entry is { url: string; thumbnailUrl?: string } => Boolean(entry));
}

export function serializeMeasurementPhotos({
  photoAssets,
  photosLegacy,
}: {
  photoAssets?: Array<{ sortOrder?: number; asset: AssetIdRef }>;
  photosLegacy?: unknown;
}) {
  if (photoAssets && photoAssets.length > 0) {
    return [...photoAssets]
      .sort((left, right) => (left.sortOrder || 0) - (right.sortOrder || 0))
      .map(({ asset }) => ({
        url: getAssetUrl(asset.id),
      }));
  }

  return parseLegacyPhotos(photosLegacy);
}

export function serializeMeasurementUpload<
  T extends {
    photoAssets?: Array<{ sortOrder?: number; asset: AssetIdRef }>;
    photosLegacy?: unknown;
  },
>(measurement: T) {
  const { photoAssets, photosLegacy, ...rest } = measurement;

  return {
    ...rest,
    photos: serializeMeasurementPhotos({ photoAssets, photosLegacy }),
  };
}

export function serializeCompanySettings<
  T extends {
    companyLogoAsset?: AssetIdRef | null;
    companyLogoLegacy?: string | null;
  },
>(settings: T | null) {
  if (!settings) {
    return null;
  }

  const { companyLogoAsset, companyLogoLegacy, ...rest } = settings;

  return {
    ...rest,
    companyLogo: companyLogoAsset ? getAssetUrl(companyLogoAsset.id) : companyLogoLegacy ?? null,
  };
}

async function buildLocalAssetCreateInput({
  kind,
  namespace,
  buffer,
  mimeType,
  originalName,
}: {
  kind: MediaAssetKind;
  namespace: StorageNamespace;
  buffer: Buffer;
  mimeType: string;
  originalName?: string | null;
}) {
  const id = randomUUID();
  const stored = await storeBuffer({
    buffer,
    mimeType,
    namespace,
    originalName,
  });

  return {
    id,
    kind,
    storageProvider: stored.storageProvider,
    storageKey: stored.storageKey,
    mimeType: stored.mimeType,
    bytes: stored.bytes,
    originalName: stored.originalName,
  };
}

export async function buildMediaAssetCreateInputFromFile({
  file,
  kind,
  namespace,
}: {
  file: File;
  kind: MediaAssetKind;
  namespace: StorageNamespace;
}) {
  const buffer = Buffer.from(await file.arrayBuffer());

  return buildLocalAssetCreateInput({
    kind,
    namespace,
    buffer,
    mimeType: file.type || "application/octet-stream",
    originalName: file.name || null,
  });
}

export async function buildMediaAssetCreateInputFromDataUrl({
  dataUrl,
  kind,
  namespace,
  originalName,
}: {
  dataUrl: string;
  kind: MediaAssetKind;
  namespace: StorageNamespace;
  originalName?: string | null;
}) {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) {
    throw new Error("Invalid data URL");
  }

  const mimeType = match[1] || "application/octet-stream";
  const isBase64Payload = match[2] === ";base64";
  const payload = match[3] || "";
  const buffer = Buffer.from(
    decodeURIComponent(payload),
    isBase64Payload ? "base64" : "utf8"
  );

  return buildLocalAssetCreateInput({
    kind,
    namespace,
    buffer,
    mimeType,
    originalName: originalName || null,
  });
}

export async function buildMediaAssetCreateInputFromLegacyUrl({
  url,
  kind,
  namespace,
  originalName,
}: {
  url: string;
  kind: MediaAssetKind;
  namespace: StorageNamespace;
  originalName?: string | null;
}) {
  if (isDataUrl(url)) {
    return buildMediaAssetCreateInputFromDataUrl({
      dataUrl: url,
      kind,
      namespace,
      originalName,
    });
  }

  return {
    id: randomUUID(),
    kind,
    storageProvider: "proxy",
    storageKey: url,
    mimeType: getMediaMimeTypeFromUrl(url),
    bytes: 0,
    originalName: originalName || null,
  };
}

export async function deleteMediaAsset(asset: {
  storageProvider: string;
  storageKey: string;
}) {
  if (asset.storageProvider === "local" || asset.storageProvider === "gcs") {
    await deleteStoredObject(asset.storageProvider, asset.storageKey);
  }
}
