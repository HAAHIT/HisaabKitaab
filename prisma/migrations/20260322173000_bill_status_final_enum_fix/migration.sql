-- Reconcile the historical BillStatus enum with the current schema.
-- Older migration history introduced FINALIZED; the live schema and application use FINAL.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'BillStatus'
      AND e.enumlabel = 'FINALIZED'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'BillStatus'
      AND e.enumlabel = 'FINAL'
  ) THEN
    ALTER TYPE "BillStatus" RENAME VALUE 'FINALIZED' TO 'FINAL';
  END IF;
END $$;
