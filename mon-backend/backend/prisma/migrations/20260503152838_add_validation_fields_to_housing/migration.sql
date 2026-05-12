-- AlterTable
ALTER TABLE "HousingUnit" ADD COLUMN     "isValidated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "validationComment" TEXT;
