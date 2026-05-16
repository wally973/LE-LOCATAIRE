-- Immatriculation logement (résidence + ville) + historique d'occupation enrichi

ALTER TABLE "Housing" ADD COLUMN IF NOT EXISTS "residenceUnitNumber" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Housing_residenceUnitNumber_key"
  ON "Housing" ("residenceUnitNumber") WHERE "residenceUnitNumber" IS NOT NULL;

ALTER TABLE "TenantHousingHistory" ADD COLUMN IF NOT EXISTS "moveOutReason" TEXT;

UPDATE "Housing"
SET "residenceUnitNumber" = 'LOG-' || "postalCode" || '-' || LPAD(id::text, 6, '0')
WHERE "residenceUnitNumber" IS NULL;
