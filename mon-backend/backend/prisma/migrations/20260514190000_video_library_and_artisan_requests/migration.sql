-- Sprint 4 : vidéothèque IA + demandes d'artisan
-- Cible : Postgres / Supabase
-- Idempotent : DO blocks pour les enums, IF NOT EXISTS pour les tables / index.

-- 1) Nouvel enum
DO $$ BEGIN
  CREATE TYPE "ArtisanRequestStatus" AS ENUM (
    'NEW',
    'TRIAGED',
    'IN_PROGRESS',
    'DONE',
    'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) VideoTutorialQuery
CREATE TABLE IF NOT EXISTS "VideoTutorialQuery" (
  "id"              SERIAL PRIMARY KEY,
  "queryNormalized" TEXT        NOT NULL,
  "category"        TEXT        NOT NULL,
  "locale"          TEXT        NOT NULL DEFAULT 'fr-FR',
  "hitCount"        INTEGER     NOT NULL DEFAULT 1,
  "lastUsedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "VideoTutorialQuery_queryNormalized_locale_key"
  ON "VideoTutorialQuery" ("queryNormalized", "locale");

CREATE INDEX IF NOT EXISTS "VideoTutorialQuery_category_idx"
  ON "VideoTutorialQuery" ("category");

-- 3) VideoTutorial
CREATE TABLE IF NOT EXISTS "VideoTutorial" (
  "id"               SERIAL PRIMARY KEY,
  "queryId"          INTEGER     NOT NULL,
  "youtubeVideoId"   TEXT        NOT NULL,
  "title"            TEXT        NOT NULL,
  "channel"          TEXT,
  "thumbnailUrl"     TEXT,
  "durationSec"      INTEGER,
  "language"         TEXT        NOT NULL DEFAULT 'fr',
  "score"            DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "validatedByAdmin" BOOLEAN     NOT NULL DEFAULT FALSE,
  "disabledByAdmin"  BOOLEAN     NOT NULL DEFAULT FALSE,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
  ALTER TABLE "VideoTutorial"
    ADD CONSTRAINT "VideoTutorial_queryId_fkey"
    FOREIGN KEY ("queryId") REFERENCES "VideoTutorialQuery"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "VideoTutorial_queryId_youtubeVideoId_key"
  ON "VideoTutorial" ("queryId", "youtubeVideoId");

CREATE INDEX IF NOT EXISTS "VideoTutorial_disabledByAdmin_idx"
  ON "VideoTutorial" ("disabledByAdmin");

-- 4) TicketVideoSuggestion
CREATE TABLE IF NOT EXISTS "TicketVideoSuggestion" (
  "id"              SERIAL PRIMARY KEY,
  "ticketId"        INTEGER     NOT NULL,
  "videoTutorialId" INTEGER     NOT NULL,
  "suggestedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantWatched"   BOOLEAN     NOT NULL DEFAULT FALSE,
  "tenantHelpful"   BOOLEAN,
  "tenantFeedback"  TEXT
);

DO $$ BEGIN
  ALTER TABLE "TicketVideoSuggestion"
    ADD CONSTRAINT "TicketVideoSuggestion_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TicketVideoSuggestion"
    ADD CONSTRAINT "TicketVideoSuggestion_videoTutorialId_fkey"
    FOREIGN KEY ("videoTutorialId") REFERENCES "VideoTutorial"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "TicketVideoSuggestion_ticketId_videoTutorialId_key"
  ON "TicketVideoSuggestion" ("ticketId", "videoTutorialId");

CREATE INDEX IF NOT EXISTS "TicketVideoSuggestion_ticketId_idx"
  ON "TicketVideoSuggestion" ("ticketId");

-- 5) ArtisanRequest
CREATE TABLE IF NOT EXISTS "ArtisanRequest" (
  "id"                SERIAL PRIMARY KEY,
  "ticketId"          INTEGER     NOT NULL,
  "tenantId"          INTEGER     NOT NULL,
  "landlordProfileId" INTEGER     NOT NULL,
  "category"          TEXT        NOT NULL,
  "severity"          TEXT        NOT NULL,
  "status"            "ArtisanRequestStatus" NOT NULL DEFAULT 'NEW',
  "requestedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "adminNotes"        TEXT,
  "slotProposedAt"    TIMESTAMP(3),
  "slotConfirmedAt"   TIMESTAMP(3),
  "completedAt"       TIMESTAMP(3),
  "tenantReason"      TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
  ALTER TABLE "ArtisanRequest"
    ADD CONSTRAINT "ArtisanRequest_ticketId_key" UNIQUE ("ticketId");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ArtisanRequest"
    ADD CONSTRAINT "ArtisanRequest_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ArtisanRequest"
    ADD CONSTRAINT "ArtisanRequest_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "TenantProfile"("id")
    ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ArtisanRequest"
    ADD CONSTRAINT "ArtisanRequest_landlordProfileId_fkey"
    FOREIGN KEY ("landlordProfileId") REFERENCES "LandlordProfile"("id")
    ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "ArtisanRequest_status_idx"
  ON "ArtisanRequest" ("status");

CREATE INDEX IF NOT EXISTS "ArtisanRequest_landlordProfileId_status_idx"
  ON "ArtisanRequest" ("landlordProfileId", "status");

CREATE INDEX IF NOT EXISTS "ArtisanRequest_tenantId_idx"
  ON "ArtisanRequest" ("tenantId");
