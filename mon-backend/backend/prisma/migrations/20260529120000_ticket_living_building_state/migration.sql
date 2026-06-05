-- LIVING_BUILDING_STATE — table de vérité Niveau 5 (Supabase)
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "livingBuildingState" JSONB;
