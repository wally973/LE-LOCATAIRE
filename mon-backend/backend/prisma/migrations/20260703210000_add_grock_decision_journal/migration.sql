CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "grock_decision_journal" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "ticketId" TEXT,
  "photoHash" TEXT,
  "title" TEXT,
  "description" TEXT,
  "tenantMessage" TEXT,
  "perception" TEXT,
  "state" TEXT,
  "responsibility" TEXT,
  "acknowledgment" TEXT,
  "noteInterne" TEXT,
  "model" TEXT,
  "visionModel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "grock_decision_journal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "grock_decision_journal_photoHash_idx"
  ON "grock_decision_journal" ("photoHash");

CREATE INDEX IF NOT EXISTS "grock_decision_journal_createdAt_idx"
  ON "grock_decision_journal" ("createdAt");
