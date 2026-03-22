-- Add missing identity relationships so operational data stops relying on fuzzy joins.

-- Bills should point to the canonical party/customer record.
ALTER TABLE "Bill" ADD COLUMN "partyId" TEXT;

-- Measurements can optionally be associated with a party/customer context.
ALTER TABLE "MeasurementUpload" ADD COLUMN "partyId" TEXT;

-- Backfill bills by exact phone match when that points to exactly one party.
UPDATE "Bill" AS b
SET "partyId" = p."id"
FROM "Party" AS p
WHERE b."partyId" IS NULL
  AND b."customerPhone" IS NOT NULL
  AND p."phone" = b."customerPhone"
  AND (
    SELECT COUNT(*)
    FROM "Party" AS p2
    WHERE p2."phone" = b."customerPhone"
  ) = 1;

-- Backfill remaining bills by exact name match when that points to exactly one party.
UPDATE "Bill" AS b
SET "partyId" = p."id"
FROM "Party" AS p
WHERE b."partyId" IS NULL
  AND p."name" = b."customerName"
  AND (
    SELECT COUNT(*)
    FROM "Party" AS p2
    WHERE p2."name" = b."customerName"
  ) = 1;

-- Backfill measurements by matching the linked customer user to exactly one customer party by phone.
UPDATE "MeasurementUpload" AS m
SET "partyId" = p."id"
FROM "User" AS u
JOIN "Party" AS p
  ON p."type" = 'CUSTOMER'
 AND p."phone" IS NOT NULL
 AND p."phone" = u."phone"
WHERE m."partyId" IS NULL
  AND m."customerId" = u."id"
  AND u."phone" IS NOT NULL
  AND (
    SELECT COUNT(*)
    FROM "Party" AS p2
    WHERE p2."type" = 'CUSTOMER'
      AND p2."phone" = u."phone"
  ) = 1;

-- Backfill remaining measurements by matching the linked customer user to exactly one customer party by email.
UPDATE "MeasurementUpload" AS m
SET "partyId" = p."id"
FROM "User" AS u
JOIN "Party" AS p
  ON p."type" = 'CUSTOMER'
 AND p."email" IS NOT NULL
 AND p."email" = u."email"
WHERE m."partyId" IS NULL
  AND m."customerId" = u."id"
  AND u."email" IS NOT NULL
  AND (
    SELECT COUNT(*)
    FROM "Party" AS p2
    WHERE p2."type" = 'CUSTOMER'
      AND p2."email" = u."email"
  ) = 1;

CREATE INDEX "Bill_partyId_idx" ON "Bill"("partyId");
CREATE INDEX "MeasurementUpload_partyId_idx" ON "MeasurementUpload"("partyId");

ALTER TABLE "Bill"
ADD CONSTRAINT "Bill_partyId_fkey"
FOREIGN KEY ("partyId") REFERENCES "Party"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "MeasurementUpload"
ADD CONSTRAINT "MeasurementUpload_partyId_fkey"
FOREIGN KEY ("partyId") REFERENCES "Party"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
