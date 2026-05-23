-- Auto-recherche = moteur du produit (anti-hallucination), activée par défaut (Q64)
ALTER TABLE "LandlordFeatureFlags" ALTER COLUMN "liaAutoResearchEnabled" SET DEFAULT true;
UPDATE "LandlordFeatureFlags" SET "liaAutoResearchEnabled" = true WHERE "liaAutoResearchEnabled" = false;
