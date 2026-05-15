-- Sprint 6B + 6A : notifications réelles (tokens, préférences) + feature flags bailleur

-- Notification : lecture
ALTER TABLE "Notification"
  ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx"
  ON "Notification" ("userId", "createdAt");

-- Sprint 6B
CREATE TABLE IF NOT EXISTS "UserNotificationSettings" (
  "userId"        INTEGER PRIMARY KEY,
  "emailEnabled"  BOOLEAN NOT NULL DEFAULT TRUE,
  "pushEnabled"   BOOLEAN NOT NULL DEFAULT TRUE
);

DO $$ BEGIN
  ALTER TABLE "UserNotificationSettings"
    ADD CONSTRAINT "UserNotificationSettings_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "DevicePushToken" (
  "id"        SERIAL PRIMARY KEY,
  "userId"    INTEGER NOT NULL,
  "token"     TEXT NOT NULL,
  "platform"  TEXT NOT NULL DEFAULT 'android',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
  ALTER TABLE "DevicePushToken"
    ADD CONSTRAINT "DevicePushToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "DevicePushToken_userId_token_key"
  ON "DevicePushToken" ("userId", "token");

CREATE INDEX IF NOT EXISTS "DevicePushToken_userId_idx"
  ON "DevicePushToken" ("userId");

-- Sprint 6A
CREATE TABLE IF NOT EXISTS "LandlordFeatureFlags" (
  "landlordProfileId"       INTEGER PRIMARY KEY,
  "ticketsModule"           BOOLEAN NOT NULL DEFAULT TRUE,
  "tenantOnboardingModule"  BOOLEAN NOT NULL DEFAULT TRUE,
  "aiRoutingModule"         BOOLEAN NOT NULL DEFAULT TRUE,
  "videoLibraryModule"      BOOLEAN NOT NULL DEFAULT TRUE,
  "artisanRequestsModule"   BOOLEAN NOT NULL DEFAULT TRUE,
  "socialModule"            BOOLEAN NOT NULL DEFAULT TRUE,
  "hlmModule"               BOOLEAN NOT NULL DEFAULT FALSE,
  "contratsModule"          BOOLEAN NOT NULL DEFAULT TRUE,
  "paiementsModule"         BOOLEAN NOT NULL DEFAULT TRUE,
  "updatedAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
  ALTER TABLE "LandlordFeatureFlags"
    ADD CONSTRAINT "LandlordFeatureFlags_landlordProfileId_fkey"
    FOREIGN KEY ("landlordProfileId") REFERENCES "LandlordProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Lignes par défaut pour les bailleurs existants
INSERT INTO "LandlordFeatureFlags" ("landlordProfileId")
SELECT lp."id" FROM "LandlordProfile" lp
WHERE NOT EXISTS (
  SELECT 1 FROM "LandlordFeatureFlags" f WHERE f."landlordProfileId" = lp."id"
);
