-- Sprint 3 : routage automatique IA des tickets locataire
-- Cible : Postgres / Supabase
-- Idempotente autant que possible (IF NOT EXISTS / DROP IF EXISTS sur ce qu'on recrée).

-- 1) Nouveaux enums
DO $$ BEGIN
  CREATE TYPE "TicketResponsibility" AS ENUM (
    'PENDING',
    'BAILLEUR',
    'LOCATAIRE',
    'NON_RECEVABLE',
    'SOCIAL',
    'ESCALADE_BAILLEUR'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "NonRecevableReason" AS ENUM (
    'JURIDIQUE_VOISIN',
    'ASSURANCE_DEGATS_EAUX',
    'ASSURANCE_AUTRE',
    'HORS_LOGEMENT',
    'HORS_PERIMETRE_APP',
    'AUTRE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Étendre l'enum TicketStatus existant
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'NEW';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'AWAITING_TENANT_PHOTO';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'AUTO_CLOSED';

-- 3) Étendre la table Ticket
ALTER TABLE "Ticket"
  ADD COLUMN IF NOT EXISTS "landlordProfileId" INTEGER,
  ADD COLUMN IF NOT EXISTS "responsibility" "TicketResponsibility" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "nonRecevableReason" "NonRecevableReason",
  ADD COLUMN IF NOT EXISTS "aiAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "aiMaxAttempts" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS "escalatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "escalationReason" TEXT,
  ADD COLUMN IF NOT EXISTS "aiLastDecision" JSONB;

-- Recopie automatique de landlordProfileId pour les anciens tickets
UPDATE "Ticket" t
SET "landlordProfileId" = h."landlordId"
FROM "Housing" h
WHERE t."housingId" = h."id"
  AND t."landlordProfileId" IS NULL;

-- Index pour le scope multi-bailleur et le tableau de bord
CREATE INDEX IF NOT EXISTS "Ticket_landlordProfileId_status_idx"
  ON "Ticket" ("landlordProfileId", "status");

CREATE INDEX IF NOT EXISTS "Ticket_responsibility_idx"
  ON "Ticket" ("responsibility");

CREATE INDEX IF NOT EXISTS "Ticket_escalatedAt_idx"
  ON "Ticket" ("escalatedAt");

CREATE INDEX IF NOT EXISTS "Ticket_tenantId_idx"
  ON "Ticket" ("tenantId");

-- 4) Lier SocialCase -> Ticket (triggerTicketId)
ALTER TABLE "SocialCase"
  ADD COLUMN IF NOT EXISTS "triggerTicketId" INTEGER;

-- Unicité : un seul SocialCase par ticket déclencheur
DO $$ BEGIN
  ALTER TABLE "SocialCase"
    ADD CONSTRAINT "SocialCase_triggerTicketId_key" UNIQUE ("triggerTicketId");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SocialCase"
    ADD CONSTRAINT "SocialCase_triggerTicketId_fkey"
    FOREIGN KEY ("triggerTicketId") REFERENCES "Ticket"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
