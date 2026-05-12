-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'ARTISAN';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isAvailable" BOOLEAN NOT NULL DEFAULT true;
