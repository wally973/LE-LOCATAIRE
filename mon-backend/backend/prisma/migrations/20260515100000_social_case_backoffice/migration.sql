-- Sprint 5 : backoffice volet social (cas sociaux, référents, journal d'événements)

-- 1) Nouveaux enums
DO $$ BEGIN
  CREATE TYPE "SocialCasePriority" AS ENUM ('NORMAL', 'HIGH');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SocialCaseEventType" AS ENUM (
    'STATUS_CHANGE',
    'CATEGORY_CHANGE',
    'NOTE_ADDED',
    'ASSIGNMENT',
    'CONTACT_LOGGED',
    'SYSTEM'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Colonnes SocialCase
ALTER TABLE "SocialCase"
  ADD COLUMN IF NOT EXISTS "assignedSocialWorkerId" INTEGER,
  ADD COLUMN IF NOT EXISTS "priority" "SocialCasePriority" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "closedReason" TEXT,
  ADD COLUMN IF NOT EXISTS "lastContactAt" TIMESTAMP(3);

DO $$ BEGIN
  ALTER TABLE "SocialCase"
    ADD CONSTRAINT "SocialCase_assignedSocialWorkerId_fkey"
    FOREIGN KEY ("assignedSocialWorkerId") REFERENCES "SocialWorker"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "SocialCase_bailleurId_status_idx"
  ON "SocialCase" ("bailleurId", "status");

CREATE INDEX IF NOT EXISTS "SocialCase_tenantId_idx"
  ON "SocialCase" ("tenantId");

CREATE INDEX IF NOT EXISTS "SocialCase_assignedSocialWorkerId_idx"
  ON "SocialCase" ("assignedSocialWorkerId");

-- 3) Table journal SocialCaseEvent
CREATE TABLE IF NOT EXISTS "SocialCaseEvent" (
  "id"            SERIAL PRIMARY KEY,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "socialCaseId"  INTEGER NOT NULL,
  "actorUserId"   INTEGER NOT NULL,
  "type"          "SocialCaseEventType" NOT NULL,
  "payload"       JSONB
);

DO $$ BEGIN
  ALTER TABLE "SocialCaseEvent"
    ADD CONSTRAINT "SocialCaseEvent_socialCaseId_fkey"
    FOREIGN KEY ("socialCaseId") REFERENCES "SocialCase"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SocialCaseEvent"
    ADD CONSTRAINT "SocialCaseEvent_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "SocialCaseEvent_socialCaseId_createdAt_idx"
  ON "SocialCaseEvent" ("socialCaseId", "createdAt");

-- 4) Unicité (userId, bailleurId) sur SocialWorker — supprime les doublons éventuels avant contrainte
DELETE FROM "SocialWorker" sw
USING "SocialWorker" sw2
WHERE sw."id" > sw2."id"
  AND sw."userId" = sw2."userId"
  AND sw."bailleurId" = sw2."bailleurId";

DO $$ BEGIN
  ALTER TABLE "SocialWorker"
    ADD CONSTRAINT "SocialWorker_userId_bailleurId_key" UNIQUE ("userId", "bailleurId");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
