/*
  Warnings:

  - You are about to drop the `TicketPhoto` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "TicketPhoto" DROP CONSTRAINT "TicketPhoto_ticketId_fkey";

-- DropTable
DROP TABLE "TicketPhoto";
