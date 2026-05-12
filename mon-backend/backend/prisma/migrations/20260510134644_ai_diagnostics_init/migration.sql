/*
  Warnings:

  - You are about to drop the `HousingUnit` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_housingId_fkey";

-- DropForeignKey
ALTER TABLE "HousingUnit" DROP CONSTRAINT "HousingUnit_landlordId_fkey";

-- DropForeignKey
ALTER TABLE "TenantHousingHistory" DROP CONSTRAINT "TenantHousingHistory_housingId_fkey";

-- DropForeignKey
ALTER TABLE "TenantProfile" DROP CONSTRAINT "TenantProfile_housingId_fkey";

-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_housingId_fkey";

-- DropTable
DROP TABLE "HousingUnit";

-- CreateTable
CREATE TABLE "Housing" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "address" TEXT NOT NULL,
    "city" "City" NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'FRANCE',
    "isInGuyane" BOOLEAN NOT NULL DEFAULT true,
    "externalRef" TEXT,
    "isValidated" BOOLEAN NOT NULL DEFAULT false,
    "validationComment" TEXT,
    "landlordId" INTEGER NOT NULL,

    CONSTRAINT "Housing_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Housing" ADD CONSTRAINT "Housing_landlordId_fkey" FOREIGN KEY ("landlordId") REFERENCES "LandlordProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantProfile" ADD CONSTRAINT "TenantProfile_housingId_fkey" FOREIGN KEY ("housingId") REFERENCES "Housing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantHousingHistory" ADD CONSTRAINT "TenantHousingHistory_housingId_fkey" FOREIGN KEY ("housingId") REFERENCES "Housing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_housingId_fkey" FOREIGN KEY ("housingId") REFERENCES "Housing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_housingId_fkey" FOREIGN KEY ("housingId") REFERENCES "Housing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
