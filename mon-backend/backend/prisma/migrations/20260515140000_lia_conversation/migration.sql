-- Sprint F (LIA) : conversation ticket + mémoire IA + statut LIA_ANALYZING

ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'LIA_ANALYZING';

CREATE TYPE "TicketMessageRole" AS ENUM ('TENANT', 'LIA_HOST', 'LIA_SYSTEM');
CREATE TYPE "AiMemoryKind" AS ENUM ('DECRET', 'RESIDENCE_ARCHIVE', 'FAQ_BAILLEUR');

CREATE TABLE IF NOT EXISTS "TicketMessage" (
  "id"        SERIAL PRIMARY KEY,
  "ticketId"  INTEGER NOT NULL,
  "role"      "TicketMessageRole" NOT NULL,
  "content"   TEXT NOT NULL,
  "locale"    TEXT NOT NULL DEFAULT 'fr-FR',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
  ALTER TABLE "TicketMessage"
    ADD CONSTRAINT "TicketMessage_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "TicketMessage_ticketId_createdAt_idx"
  ON "TicketMessage" ("ticketId", "createdAt");

CREATE TABLE IF NOT EXISTS "AiMemory" (
  "id"                SERIAL PRIMARY KEY,
  "landlordProfileId" INTEGER,
  "housingId"         INTEGER,
  "kind"              "AiMemoryKind" NOT NULL,
  "title"             TEXT NOT NULL,
  "content"           TEXT NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AiMemory_landlordProfileId_kind_idx"
  ON "AiMemory" ("landlordProfileId", "kind");
CREATE INDEX IF NOT EXISTS "AiMemory_housingId_idx"
  ON "AiMemory" ("housingId");
