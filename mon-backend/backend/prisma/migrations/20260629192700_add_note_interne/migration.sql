CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "grock_messages" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "role" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "thinking" TEXT,
  "state" TEXT,
  "next_action" TEXT,
  "acknowledgment" TEXT,
  "note_interne" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "grock_messages_pkey" PRIMARY KEY ("id")
);
