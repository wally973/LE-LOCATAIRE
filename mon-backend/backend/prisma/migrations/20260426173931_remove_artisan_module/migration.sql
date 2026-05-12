/*
  Warnings:

  - The values [ARTISAN] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `artisanId` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `aiSuggestedArtisanId` on the `Ticket` table. All the data in the column will be lost.
  - You are about to drop the column `artisanId` on the `Ticket` table. All the data in the column will be lost.
  - You are about to drop the `ArtisanProfile` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CallLog` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('TENANT', 'LANDLORD', 'ADMIN');
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "ArtisanProfile" DROP CONSTRAINT "ArtisanProfile_userId_fkey";

-- DropForeignKey
ALTER TABLE "CallLog" DROP CONSTRAINT "CallLog_callerId_fkey";

-- DropForeignKey
ALTER TABLE "CallLog" DROP CONSTRAINT "CallLog_ticketId_fkey";

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_artisanId_fkey";

-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_artisanId_fkey";

-- AlterTable
ALTER TABLE "Invoice" DROP COLUMN "artisanId";

-- AlterTable
ALTER TABLE "Ticket" DROP COLUMN "aiSuggestedArtisanId",
DROP COLUMN "artisanId",
ADD COLUMN     "aiSuggestedArtisanType" TEXT;

-- DropTable
DROP TABLE "ArtisanProfile";

-- DropTable
DROP TABLE "CallLog";

-- DropEnum
DROP TYPE "CallStatus";

-- DropEnum
DROP TYPE "CallType";

-- DropEnum
DROP TYPE "TicketResponsibility";
