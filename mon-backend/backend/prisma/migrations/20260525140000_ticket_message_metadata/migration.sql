-- Statut visuel sous les messages Lia (synchronisé avec la parole).
ALTER TABLE "TicketMessage" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
