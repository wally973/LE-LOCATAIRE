-- Actions de qualification activables par bailleur (Q63)
ALTER TABLE "LandlordFeatureFlags" ADD COLUMN "liaConversationEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "LandlordFeatureFlags" ADD COLUMN "requirePhotoEvidence" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "LandlordFeatureFlags" ADD COLUMN "liaAutoResearchEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LandlordFeatureFlags" ADD COLUMN "technicianCreateTicketEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LandlordFeatureFlags" ADD COLUMN "liaTicketRelanceEnabled" BOOLEAN NOT NULL DEFAULT false;
