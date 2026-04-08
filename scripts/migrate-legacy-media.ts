import { prisma } from "../src/lib/prisma";
import {
  buildMediaAssetCreateInputFromLegacyUrl,
  deleteMediaAsset,
  extractLegacyPhotoUrl,
} from "../src/lib/media";

/**
 * Migrates tenant logo URLs from legacy external locations into `mediaAsset` records and updates tenants to reference the new `/api/assets/{assetId}` endpoint.
 *
 * Skips tenants with no `logoUrl` or whose `logoUrl` already starts with `/api/assets/`. For each eligible tenant it creates a `COMPANY_LOGO` media asset and updates the tenant's `logoUrl` and `updatedAt` inside a transaction. If the transaction fails, it attempts to delete the created asset and rethrows the original error.
 *
 * @returns The number of tenants successfully migrated
 */
async function migrateCompanyLogo() {
  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      logoUrl: true,
    },
  });

  let migratedCount = 0;

  for (const tenant of tenants) {
    if (!tenant.logoUrl || tenant.logoUrl.startsWith("/api/assets/")) {
      continue;
    }

    const asset = await buildMediaAssetCreateInputFromLegacyUrl({
      url: tenant.logoUrl,
      kind: "COMPANY_LOGO",
      namespace: "company-logos",
      originalName: `company-logo-${tenant.id}`,
    });

    try {
      await prisma.$transaction(async (tx) => {
        await tx.mediaAsset.create({ data: asset });
        await tx.tenant.update({
          where: { id: tenant.id },
          data: {
            logoUrl: `/api/assets/${asset.id}`,
            updatedAt: new Date(),
          },
        });
      });

      migratedCount += 1;
    } catch (error) {
      await deleteMediaAsset(asset).catch(() => undefined);
      throw error;
    }
  }

  return migratedCount;
}

/**
 * Migrates legacy measurement photos into media assets and links them to measurement uploads.
 *
 * For each measurementUpload without existing photoAssets, this function:
 * - extracts valid legacy photo URLs from `photosLegacy`,
 * - creates corresponding `mediaAsset` records,
 * - clears `photosLegacy`,
 * - and creates `photoAssets` entries referencing the new assets with `sortOrder` matching the original order.
 * Measurements that already have `photoAssets` or have no valid legacy URLs are skipped.
 * If a transaction fails, the function attempts to delete any created media assets (swallowing deletion errors) and re-throws the original error.
 *
 * @returns The number of measurementUpload records migrated successfully.
 * @throws The original error from a failed migration transaction after cleanup attempts.
 */
async function migrateMeasurementPhotos() {
  const measurements = await prisma.measurementUpload.findMany({
    select: {
      id: true,
      photosLegacy: true,
      photoAssets: {
        select: { id: true },
      },
    },
  });

  let migratedCount = 0;

  for (const measurement of measurements) {
    if (measurement.photoAssets.length > 0) {
      continue;
    }

    const legacyPhotoUrls = Array.isArray(measurement.photosLegacy)
      ? measurement.photosLegacy
          .map((entry) => extractLegacyPhotoUrl(entry))
          .filter((entry): entry is string => Boolean(entry))
      : [];

    if (legacyPhotoUrls.length === 0) {
      continue;
    }

    const assets: Array<
      Awaited<ReturnType<typeof buildMediaAssetCreateInputFromLegacyUrl>>
    > = [];

    try {
      for (let index = 0; index < legacyPhotoUrls.length; index += 1) {
        assets.push(
          await buildMediaAssetCreateInputFromLegacyUrl({
            url: legacyPhotoUrls[index],
            kind: "MEASUREMENT_PHOTO",
            namespace: "measurement-photos",
            originalName: `measurement-${measurement.id}-${index + 1}`,
          })
        );
      }

      await prisma.$transaction(async (tx) => {
        for (const asset of assets) {
          await tx.mediaAsset.create({ data: asset });
        }

        await tx.measurementUpload.update({
          where: { id: measurement.id },
          data: {
            photosLegacy: [],
            photoAssets: {
              create: assets.map((asset, index) => ({
                assetId: asset.id,
                sortOrder: index,
              })),
            },
          },
        });
      });

      migratedCount += 1;
    } catch (error) {
      await Promise.all(
        assets.map((asset) => deleteMediaAsset(asset).catch(() => undefined))
      );
      throw error;
    }
  }

  return migratedCount;
}

async function main() {
  const migratedLogo = await migrateCompanyLogo();
  const migratedMeasurements = await migrateMeasurementPhotos();

  console.log(
    JSON.stringify(
      {
        migratedLogo,
        migratedMeasurements,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error("Legacy media migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
