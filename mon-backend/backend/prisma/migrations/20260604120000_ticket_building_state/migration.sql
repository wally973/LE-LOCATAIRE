-- State-Based Reasoning — table de vérité unique (Supabase)
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "buildingState" JSONB;
