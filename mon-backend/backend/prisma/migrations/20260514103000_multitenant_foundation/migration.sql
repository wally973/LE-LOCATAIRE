-- Migration : fondation multi-tenant
-- - Suppression des annuaires doublons (Bailleur / Locataire / BienImmobilier)
-- - Refonte de ContratLocation pour pointer vers LandlordProfile / TenantProfile / Housing
-- - Ajout du rôle AGENT et des modèles Agence + AgentProfile
-- - Ajout du rattachement optionnel d'un Housing à une Agence (secteur)

-- 1) Drop des FK et tables liées aux anciens annuaires
DROP TABLE IF EXISTS "Paiement" CASCADE;
DROP TABLE IF EXISTS "ContratLocation" CASCADE;
DROP TABLE IF EXISTS "BienImmobilier" CASCADE;
DROP TABLE IF EXISTS "Locataire" CASCADE;
DROP TABLE IF EXISTS "Bailleur" CASCADE;

-- 2) Ajout de la valeur AGENT à l'enum Role (en dehors d'une transaction Postgres)
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'AGENT';

-- 3) Création du modèle Agence (agence / gérance d'un bailleur)
CREATE TABLE "Agence" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" "City",
    "postalCode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "landlordProfileId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Agence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Agence_landlordProfileId_idx" ON "Agence"("landlordProfileId");

ALTER TABLE "Agence"
    ADD CONSTRAINT "Agence_landlordProfileId_fkey"
    FOREIGN KEY ("landlordProfileId")
    REFERENCES "LandlordProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 4) Création du modèle AgentProfile (profil métier pour le rôle AGENT)
CREATE TABLE "AgentProfile" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "landlordProfileId" INTEGER NOT NULL,
    "agenceId" INTEGER,
    "fonction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgentProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentProfile_userId_key" ON "AgentProfile"("userId");
CREATE INDEX "AgentProfile_landlordProfileId_idx" ON "AgentProfile"("landlordProfileId");
CREATE INDEX "AgentProfile_agenceId_idx" ON "AgentProfile"("agenceId");

ALTER TABLE "AgentProfile"
    ADD CONSTRAINT "AgentProfile_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentProfile"
    ADD CONSTRAINT "AgentProfile_landlordProfileId_fkey"
    FOREIGN KEY ("landlordProfileId")
    REFERENCES "LandlordProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentProfile"
    ADD CONSTRAINT "AgentProfile_agenceId_fkey"
    FOREIGN KEY ("agenceId")
    REFERENCES "Agence"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- 5) Rattachement d'un logement à une agence/secteur (optionnel)
ALTER TABLE "Housing" ADD COLUMN IF NOT EXISTS "agenceId" INTEGER;
CREATE INDEX IF NOT EXISTS "Housing_landlordId_idx" ON "Housing"("landlordId");
CREATE INDEX IF NOT EXISTS "Housing_agenceId_idx" ON "Housing"("agenceId");

ALTER TABLE "Housing"
    ADD CONSTRAINT "Housing_agenceId_fkey"
    FOREIGN KEY ("agenceId")
    REFERENCES "Agence"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- 6) Recréation de ContratLocation reliée aux modèles métier
CREATE TABLE "ContratLocation" (
    "id" SERIAL NOT NULL,
    "landlordProfileId" INTEGER NOT NULL,
    "tenantProfileId" INTEGER NOT NULL,
    "housingId" INTEGER NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3),
    "loyerMensuel" DOUBLE PRECISION NOT NULL,
    "depotGarantie" DOUBLE PRECISION,
    "statut" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContratLocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContratLocation_landlordProfileId_idx" ON "ContratLocation"("landlordProfileId");
CREATE INDEX "ContratLocation_tenantProfileId_idx" ON "ContratLocation"("tenantProfileId");
CREATE INDEX "ContratLocation_housingId_idx" ON "ContratLocation"("housingId");

ALTER TABLE "ContratLocation"
    ADD CONSTRAINT "ContratLocation_landlordProfileId_fkey"
    FOREIGN KEY ("landlordProfileId")
    REFERENCES "LandlordProfile"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ContratLocation"
    ADD CONSTRAINT "ContratLocation_tenantProfileId_fkey"
    FOREIGN KEY ("tenantProfileId")
    REFERENCES "TenantProfile"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ContratLocation"
    ADD CONSTRAINT "ContratLocation_housingId_fkey"
    FOREIGN KEY ("housingId")
    REFERENCES "Housing"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- 7) Recréation de Paiement (relation inchangée : lié au contrat)
CREATE TABLE "Paiement" (
    "id" SERIAL NOT NULL,
    "contratId" INTEGER NOT NULL,
    "datePaiement" TIMESTAMP(3) NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "moyenPaiement" TEXT NOT NULL,
    "statut" TEXT NOT NULL,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Paiement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Paiement_reference_key" ON "Paiement"("reference");
CREATE INDEX "Paiement_contratId_idx" ON "Paiement"("contratId");

ALTER TABLE "Paiement"
    ADD CONSTRAINT "Paiement_contratId_fkey"
    FOREIGN KEY ("contratId")
    REFERENCES "ContratLocation"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
