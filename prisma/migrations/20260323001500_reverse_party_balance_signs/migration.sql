-- Flip party balance signs so positive means advance and negative means outstanding.
UPDATE "Party"
SET
  "openingBalance" = -"openingBalance",
  "currentBalance" = -"currentBalance";
