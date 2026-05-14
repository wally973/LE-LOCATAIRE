-- Migration : table TenantRegistrationRequest (onboarding locataire self-service)
-- Le locataire choisit son bailleur, saisit ses infos + son logement,
-- et reste en attente de validation par le bailleur.

CREATE TYPE "TenantRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "TenantRegistrationRequest" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "landlordProfileId" INTEGER NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "building" TEXT,
    "floor" TEXT,
    "apartmentNumber" TEXT,
    "postalCode" TEXT NOT NULL,
    "city" "City" NOT NULL,
    "contractStartDate" TIMESTAMP(3),
    "status" "TenantRequestStatus" NOT NULL DEFAULT 'PENDING',
    "approvedTenantProfileId" INTEGER,
    "approvedHousingId" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantRegistrationRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantRegistrationRequest_approvedTenantProfileId_key"
    ON "TenantRegistrationRequest"("approvedTenantProfileId");
CREATE INDEX "TenantRegistrationRequest_landlordProfileId_status_idx"
    ON "TenantRegistrationRequest"("landlordProfileId", "status");
CREATE INDEX "TenantRegistrationRequest_userId_idx"
    ON "TenantRegistrationRequest"("userId");
CREATE INDEX "TenantRegistrationRequest_status_idx"
    ON "TenantRegistrationRequest"("status");

ALTER TABLE "TenantRegistrationRequest"
    ADD CONSTRAINT "TenantRegistrationRequest_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TenantRegistrationRequest"
    ADD CONSTRAINT "TenantRegistrationRequest_landlordProfileId_fkey"
    FOREIGN KEY ("landlordProfileId") REFERENCES "LandlordProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TenantRegistrationRequest"
    ADD CONSTRAINT "TenantRegistrationRequest_approvedTenantProfileId_fkey"
    FOREIGN KEY ("approvedTenantProfileId") REFERENCES "TenantProfile"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TenantRegistrationRequest"
    ADD CONSTRAINT "TenantRegistrationRequest_approvedHousingId_fkey"
    FOREIGN KEY ("approvedHousingId") REFERENCES "Housing"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
