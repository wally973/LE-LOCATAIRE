/*
  Warnings:

  - A unique constraint covering the columns `[hlmLogementId]` on the table `Housing` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[hlmBailleurId]` on the table `LandlordProfile` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[authSubject]` on the table `TenantProfile` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[hlmLocataireId]` on the table `TenantProfile` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "EntretienTypeCode" AS ENUM ('VMC', 'CHAUFFE_EAU_SOLAIRE', 'SIPHONS', 'JOINTS', 'RADIATEURS', 'AERATIONS', 'CAPTEURS_SOLAIRES', 'EXTERIEUR_PRIVATIF', 'EXT_COUR', 'EXT_JARDIN', 'EXT_TERRASSE', 'EXT_PATIO', 'AUTRE');

-- CreateEnum
CREATE TYPE "MaintenanceFrequency" AS ENUM ('MENSUEL', 'TRIMESTRIEL', 'ANNUEL');

-- CreateEnum
CREATE TYPE "EntretienPreuveStatut" AS ENUM ('BROUILLON', 'SOUMISE', 'VALIDEE_IA', 'REFUSEE_IA', 'VALIDEE_BAILLEUR', 'REFUSEE_BAILLEUR');

-- CreateEnum
CREATE TYPE "HlmTicketCategory" AS ENUM ('MOUSTIQUES', 'NUISIBLE', 'EVACUATION', 'INFILTRATION', 'ODEUR', 'PLOMBERIE', 'ELECTRICITE', 'STRUCTURE', 'AUTRE');

-- CreateEnum
CREATE TYPE "HlmTicketUrgency" AS ENUM ('BASSE', 'NORMALE', 'HAUTE', 'CRITIQUE');

-- CreateEnum
CREATE TYPE "HlmTicketRoutingTarget" AS ENUM ('NONE', 'GPA', 'BIENNALE', 'DECENNALE', 'BAILLEUR', 'ARTISAN', 'SERVICE_TECHNIQUE_INTERNE');

-- CreateEnum
CREATE TYPE "HlmTicketStatus" AS ENUM ('BROUILLON', 'OUVERT', 'EN_COURS', 'RESOLU', 'ANNULE', 'BLOQUE_ENTRETIEN');

-- CreateEnum
CREATE TYPE "WarrantyPhase" AS ENUM ('GPA_ACTIVE', 'BIENNALE_ACTIVE', 'DECENNALE_ACTIVE', 'HORS_GARANTIE');

-- CreateEnum
CREATE TYPE "HlmIAResultKind" AS ENUM ('ANALYSE_IMAGE', 'VALIDATION_PREUVE', 'DIAGNOSTIC_ENTRETIEN', 'ROUTAGE_TICKET');

-- AlterTable
ALTER TABLE "Housing" ADD COLUMN     "hlmLogementId" TEXT;

-- AlterTable
ALTER TABLE "LandlordProfile" ADD COLUMN     "gpaServiceEmail" TEXT,
ADD COLUMN     "gpaServicePhone" TEXT,
ADD COLUMN     "hasInternalGPAService" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hlmBailleurId" TEXT;

-- AlterTable
ALTER TABLE "TenantProfile" ADD COLUMN     "authSubject" TEXT,
ADD COLUMN     "hlmLocataireId" TEXT;

-- CreateTable
CREATE TABLE "HlmBailleur" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "corporateName" TEXT NOT NULL,
    "siren" VARCHAR(14),
    "hasInternalGPAService" BOOLEAN NOT NULL DEFAULT false,
    "gpaServiceEmail" TEXT,
    "gpaServicePhone" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,

    CONSTRAINT "HlmBailleur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HlmBailleurUser" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bailleurId" TEXT NOT NULL,
    "legacyUserId" INTEGER,
    "role" TEXT NOT NULL DEFAULT 'GESTIONNAIRE',

    CONSTRAINT "HlmBailleurUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HlmLocataire" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "authSubject" TEXT,
    "legacyTenantProfileId" INTEGER,

    CONSTRAINT "HlmLocataire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HlmResidence" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "bailleurId" TEXT NOT NULL,
    "constructionYear" INTEGER,
    "deliveryDate" DATE NOT NULL,
    "residenceNeuve" BOOLEAN NOT NULL DEFAULT false,
    "hasInternalGPAServicePerResidence" BOOLEAN NOT NULL DEFAULT false,
    "gpaEndDate" DATE NOT NULL,
    "biennaleEndDate" DATE NOT NULL,
    "decennaleEndDate" DATE NOT NULL,

    CONSTRAINT "HlmResidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HlmLogement" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "label" TEXT NOT NULL,
    "externalRef" TEXT,
    "residenceId" TEXT NOT NULL,
    "hasVmc" BOOLEAN NOT NULL DEFAULT false,
    "hasSolarWaterHeater" BOOLEAN NOT NULL DEFAULT false,
    "hasCour" BOOLEAN NOT NULL DEFAULT false,
    "hasJardin" BOOLEAN NOT NULL DEFAULT false,
    "hasTerrasse" BOOLEAN NOT NULL DEFAULT false,
    "hasPatio" BOOLEAN NOT NULL DEFAULT false,
    "locataireId" TEXT,

    CONSTRAINT "HlmLogement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HlmEntretienType" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "code" "EntretienTypeCode" NOT NULL,
    "labelFr" TEXT NOT NULL,
    "description" TEXT,
    "frequency" "MaintenanceFrequency" NOT NULL,
    "requiresOutdoorContext" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "HlmEntretienType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HlmChecklistTemplate" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entretienTypeId" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "HlmChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HlmLogementEntretien" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "logementId" TEXT NOT NULL,
    "entretienTypeId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "nextDueAt" TIMESTAMP(3),
    "lastCompletedAt" TIMESTAMP(3),

    CONSTRAINT "HlmLogementEntretien_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HlmEntretienPreuve" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "logementEntretienId" TEXT NOT NULL,
    "locataireId" TEXT,
    "checklist" JSONB NOT NULL,
    "photo1Url" TEXT NOT NULL,
    "photo2Url" TEXT NOT NULL,
    "validatedByAI" BOOLEAN NOT NULL DEFAULT false,
    "validatedByLandlord" BOOLEAN NOT NULL DEFAULT false,
    "statut" "EntretienPreuveStatut" NOT NULL DEFAULT 'BROUILLON',
    "landlordValidatedAt" TIMESTAMP(3),
    "aiValidatedAt" TIMESTAMP(3),

    CONSTRAINT "HlmEntretienPreuve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HlmTicket" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "HlmTicketCategory" NOT NULL,
    "urgency" "HlmTicketUrgency" NOT NULL DEFAULT 'NORMALE',
    "status" "HlmTicketStatus" NOT NULL DEFAULT 'BROUILLON',
    "warrantyPhaseAtCreation" "WarrantyPhase",
    "routingTarget" "HlmTicketRoutingTarget" NOT NULL DEFAULT 'NONE',
    "routingNotes" VARCHAR(1024),
    "entretienBlocked" BOOLEAN NOT NULL DEFAULT false,
    "blockedReason" VARCHAR(512),
    "logementId" TEXT NOT NULL,
    "locataireId" TEXT,

    CONSTRAINT "HlmTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HlmIAResult" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" "HlmIAResultKind" NOT NULL,
    "imageAnalysis" JSONB,
    "diagnostic" JSONB,
    "routingIA" JSONB,
    "confidence" DOUBLE PRECISION,
    "ticketId" TEXT,
    "entretienPreuveId" TEXT,
    "modelVersion" TEXT DEFAULT 'v1',

    CONSTRAINT "HlmIAResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HlmBailleur_siren_idx" ON "HlmBailleur"("siren");

-- CreateIndex
CREATE INDEX "HlmBailleurUser_bailleurId_idx" ON "HlmBailleurUser"("bailleurId");

-- CreateIndex
CREATE INDEX "HlmBailleurUser_legacyUserId_idx" ON "HlmBailleurUser"("legacyUserId");

-- CreateIndex
CREATE UNIQUE INDEX "HlmLocataire_authSubject_key" ON "HlmLocataire"("authSubject");

-- CreateIndex
CREATE UNIQUE INDEX "HlmLocataire_legacyTenantProfileId_key" ON "HlmLocataire"("legacyTenantProfileId");

-- CreateIndex
CREATE INDEX "HlmLocataire_legacyTenantProfileId_idx" ON "HlmLocataire"("legacyTenantProfileId");

-- CreateIndex
CREATE INDEX "HlmResidence_bailleurId_idx" ON "HlmResidence"("bailleurId");

-- CreateIndex
CREATE INDEX "HlmResidence_deliveryDate_idx" ON "HlmResidence"("deliveryDate");

-- CreateIndex
CREATE INDEX "HlmResidence_gpaEndDate_idx" ON "HlmResidence"("gpaEndDate");

-- CreateIndex
CREATE INDEX "HlmResidence_biennaleEndDate_idx" ON "HlmResidence"("biennaleEndDate");

-- CreateIndex
CREATE INDEX "HlmResidence_decennaleEndDate_idx" ON "HlmResidence"("decennaleEndDate");

-- CreateIndex
CREATE INDEX "HlmLogement_residenceId_idx" ON "HlmLogement"("residenceId");

-- CreateIndex
CREATE INDEX "HlmLogement_locataireId_idx" ON "HlmLogement"("locataireId");

-- CreateIndex
CREATE UNIQUE INDEX "HlmEntretienType_code_key" ON "HlmEntretienType"("code");

-- CreateIndex
CREATE INDEX "HlmChecklistTemplate_entretienTypeId_idx" ON "HlmChecklistTemplate"("entretienTypeId");

-- CreateIndex
CREATE INDEX "HlmLogementEntretien_logementId_idx" ON "HlmLogementEntretien"("logementId");

-- CreateIndex
CREATE INDEX "HlmLogementEntretien_nextDueAt_idx" ON "HlmLogementEntretien"("nextDueAt");

-- CreateIndex
CREATE UNIQUE INDEX "HlmLogementEntretien_logementId_entretienTypeId_key" ON "HlmLogementEntretien"("logementId", "entretienTypeId");

-- CreateIndex
CREATE INDEX "HlmEntretienPreuve_locataireId_idx" ON "HlmEntretienPreuve"("locataireId");

-- CreateIndex
CREATE INDEX "HlmEntretienPreuve_logementEntretienId_idx" ON "HlmEntretienPreuve"("logementEntretienId");

-- CreateIndex
CREATE INDEX "HlmTicket_logementId_idx" ON "HlmTicket"("logementId");

-- CreateIndex
CREATE INDEX "HlmTicket_locataireId_idx" ON "HlmTicket"("locataireId");

-- CreateIndex
CREATE INDEX "HlmTicket_status_idx" ON "HlmTicket"("status");

-- CreateIndex
CREATE INDEX "HlmTicket_routingTarget_idx" ON "HlmTicket"("routingTarget");

-- CreateIndex
CREATE INDEX "HlmTicket_createdAt_idx" ON "HlmTicket"("createdAt");

-- CreateIndex
CREATE INDEX "HlmTicket_entretienBlocked_idx" ON "HlmTicket"("entretienBlocked");

-- CreateIndex
CREATE INDEX "HlmIAResult_ticketId_idx" ON "HlmIAResult"("ticketId");

-- CreateIndex
CREATE INDEX "HlmIAResult_entretienPreuveId_idx" ON "HlmIAResult"("entretienPreuveId");

-- CreateIndex
CREATE INDEX "HlmIAResult_kind_idx" ON "HlmIAResult"("kind");

-- CreateIndex
CREATE INDEX "HlmIAResult_createdAt_idx" ON "HlmIAResult"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Housing_hlmLogementId_key" ON "Housing"("hlmLogementId");

-- CreateIndex
CREATE UNIQUE INDEX "LandlordProfile_hlmBailleurId_key" ON "LandlordProfile"("hlmBailleurId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantProfile_authSubject_key" ON "TenantProfile"("authSubject");

-- CreateIndex
CREATE UNIQUE INDEX "TenantProfile_hlmLocataireId_key" ON "TenantProfile"("hlmLocataireId");

-- AddForeignKey
ALTER TABLE "LandlordProfile" ADD CONSTRAINT "LandlordProfile_hlmBailleurId_fkey" FOREIGN KEY ("hlmBailleurId") REFERENCES "HlmBailleur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Housing" ADD CONSTRAINT "Housing_hlmLogementId_fkey" FOREIGN KEY ("hlmLogementId") REFERENCES "HlmLogement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantProfile" ADD CONSTRAINT "TenantProfile_hlmLocataireId_fkey" FOREIGN KEY ("hlmLocataireId") REFERENCES "HlmLocataire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HlmBailleurUser" ADD CONSTRAINT "HlmBailleurUser_bailleurId_fkey" FOREIGN KEY ("bailleurId") REFERENCES "HlmBailleur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HlmResidence" ADD CONSTRAINT "HlmResidence_bailleurId_fkey" FOREIGN KEY ("bailleurId") REFERENCES "HlmBailleur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HlmLogement" ADD CONSTRAINT "HlmLogement_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "HlmResidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HlmLogement" ADD CONSTRAINT "HlmLogement_locataireId_fkey" FOREIGN KEY ("locataireId") REFERENCES "HlmLocataire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HlmChecklistTemplate" ADD CONSTRAINT "HlmChecklistTemplate_entretienTypeId_fkey" FOREIGN KEY ("entretienTypeId") REFERENCES "HlmEntretienType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HlmLogementEntretien" ADD CONSTRAINT "HlmLogementEntretien_logementId_fkey" FOREIGN KEY ("logementId") REFERENCES "HlmLogement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HlmLogementEntretien" ADD CONSTRAINT "HlmLogementEntretien_entretienTypeId_fkey" FOREIGN KEY ("entretienTypeId") REFERENCES "HlmEntretienType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HlmEntretienPreuve" ADD CONSTRAINT "HlmEntretienPreuve_logementEntretienId_fkey" FOREIGN KEY ("logementEntretienId") REFERENCES "HlmLogementEntretien"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HlmEntretienPreuve" ADD CONSTRAINT "HlmEntretienPreuve_locataireId_fkey" FOREIGN KEY ("locataireId") REFERENCES "HlmLocataire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HlmTicket" ADD CONSTRAINT "HlmTicket_logementId_fkey" FOREIGN KEY ("logementId") REFERENCES "HlmLogement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HlmTicket" ADD CONSTRAINT "HlmTicket_locataireId_fkey" FOREIGN KEY ("locataireId") REFERENCES "HlmLocataire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HlmIAResult" ADD CONSTRAINT "HlmIAResult_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "HlmTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HlmIAResult" ADD CONSTRAINT "HlmIAResult_entretienPreuveId_fkey" FOREIGN KEY ("entretienPreuveId") REFERENCES "HlmEntretienPreuve"("id") ON DELETE SET NULL ON UPDATE CASCADE;
