-- PreprocessedSignal (Couche 0) + interlocuteur dans le journal Grock.
ALTER TABLE "grock_decision_journal" ADD COLUMN IF NOT EXISTS "interlocutor" TEXT;
ALTER TABLE "grock_decision_journal" ADD COLUMN IF NOT EXISTS "preprocessedSignal" TEXT;
