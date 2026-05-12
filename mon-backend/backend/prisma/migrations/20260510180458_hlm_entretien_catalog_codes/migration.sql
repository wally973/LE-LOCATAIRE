-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EntretienTypeCode" ADD VALUE 'VMC_FILTRE';
ALTER TYPE "EntretienTypeCode" ADD VALUE 'VMC_BOITIER';
ALTER TYPE "EntretienTypeCode" ADD VALUE 'SOL_CAPTEUR';
ALTER TYPE "EntretienTypeCode" ADD VALUE 'SOL_PRESSION';
ALTER TYPE "EntretienTypeCode" ADD VALUE 'SIPHON_NETTOYAGE';
ALTER TYPE "EntretienTypeCode" ADD VALUE 'EXT_TONTE';
ALTER TYPE "EntretienTypeCode" ADD VALUE 'EXT_DEBROUSSAILLAGE';
ALTER TYPE "EntretienTypeCode" ADD VALUE 'EXT_GOUTTIERE';
ALTER TYPE "EntretienTypeCode" ADD VALUE 'EXT_EAU_STAGNANTE';

-- AlterEnum
ALTER TYPE "MaintenanceFrequency" ADD VALUE 'HEBDOMADAIRE';
