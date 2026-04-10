-- Add reusable tenant-scoped item catalog for setup and faster billing.

CREATE TABLE "ItemCatalog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hsnCode" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxRate" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemCatalog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ItemCatalog_tenantId_idx" ON "ItemCatalog"("tenantId");
CREATE INDEX "ItemCatalog_tenantId_name_idx" ON "ItemCatalog"("tenantId", "name");

ALTER TABLE "ItemCatalog"
ADD CONSTRAINT "ItemCatalog_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
