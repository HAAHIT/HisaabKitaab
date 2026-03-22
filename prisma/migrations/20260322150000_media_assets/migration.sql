-- Normalize uploaded media so the database stores metadata instead of base64 blobs.

CREATE TYPE "MediaAssetKind" AS ENUM ('COMPANY_LOGO', 'MEASUREMENT_PHOTO');

CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "kind" "MediaAssetKind" NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "originalName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeasurementPhoto" (
    "id" TEXT NOT NULL,
    "measurementId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeasurementPhoto_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CompanySettings"
ADD COLUMN "companyLogoAssetId" TEXT;

CREATE UNIQUE INDEX "MediaAsset_storageKey_key" ON "MediaAsset"("storageKey");
CREATE INDEX "MeasurementPhoto_measurementId_sortOrder_idx" ON "MeasurementPhoto"("measurementId", "sortOrder");
CREATE INDEX "MeasurementPhoto_assetId_idx" ON "MeasurementPhoto"("assetId");
CREATE INDEX "CompanySettings_companyLogoAssetId_idx" ON "CompanySettings"("companyLogoAssetId");

ALTER TABLE "MeasurementPhoto"
ADD CONSTRAINT "MeasurementPhoto_measurementId_fkey"
FOREIGN KEY ("measurementId") REFERENCES "MeasurementUpload"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "MeasurementPhoto"
ADD CONSTRAINT "MeasurementPhoto_assetId_fkey"
FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "CompanySettings"
ADD CONSTRAINT "CompanySettings_companyLogoAssetId_fkey"
FOREIGN KEY ("companyLogoAssetId") REFERENCES "MediaAsset"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
