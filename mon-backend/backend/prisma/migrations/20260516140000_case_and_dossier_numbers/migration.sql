-- Numéros d'affaire (ticket) et dossier locataire

ALTER TABLE "TenantProfile" ADD COLUMN IF NOT EXISTS "dossierNumber" TEXT;
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "caseNumber" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "TenantProfile_dossierNumber_key"
  ON "TenantProfile" ("dossierNumber") WHERE "dossierNumber" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Ticket_caseNumber_key"
  ON "Ticket" ("caseNumber") WHERE "caseNumber" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Ticket_caseNumber_idx" ON "Ticket" ("caseNumber");

-- Rétro-remplissage des enregistrements existants
UPDATE "TenantProfile"
SET "dossierNumber" = 'DOS-' || LPAD(id::text, 6, '0')
WHERE "dossierNumber" IS NULL;

UPDATE "Ticket"
SET "caseNumber" = 'AFF-' || TO_CHAR(COALESCE("createdAt", NOW()), 'YYYY') || '-' || LPAD(id::text, 6, '0')
WHERE "caseNumber" IS NULL;
