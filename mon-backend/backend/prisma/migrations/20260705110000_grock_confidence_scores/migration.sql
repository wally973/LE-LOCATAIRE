-- Scores de confiance Grock (Couche 0 + 5 têtes) pour journal et sondes.
ALTER TABLE "grock_decision_journal" ADD COLUMN IF NOT EXISTS "signalQuality" INTEGER;
ALTER TABLE "grock_decision_journal" ADD COLUMN IF NOT EXISTS "scores" TEXT;
