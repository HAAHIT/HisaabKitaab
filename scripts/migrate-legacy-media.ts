import { prisma } from "../src/lib/prisma";
import {
  buildMediaAssetCreateInputFromLegacyUrl,
  deleteMediaAsset,
  extractLegacyPhotoUrl,
} from "../src/lib/media";

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
