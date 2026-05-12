-- Diagnostics IA anonymisés (pas de libellés Prisma avec casse mélangée pour la table mappée)
CREATE TABLE "ai_diagnostics" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userHash" TEXT NOT NULL,
    "locale" VARCHAR(16) NOT NULL,
    "category" VARCHAR(64) NOT NULL,
    "severity" VARCHAR(16) NOT NULL,
    "target" VARCHAR(24) NOT NULL,
    "refused" BOOLEAN NOT NULL,
    "refusalReason" VARCHAR(512),
    "diagnosticSummary" TEXT NOT NULL,
    "pipelineSteps" JSONB,
    "avatarVariant" VARCHAR(32),
    "artisanType" VARCHAR(64),
    "bailleurFlag" BOOLEAN NOT NULL DEFAULT false,
    "adminFlag" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ai_diagnostics_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_diagnostics_createdAt_idx" ON "ai_diagnostics"("createdAt");
CREATE INDEX "ai_diagnostics_userHash_idx" ON "ai_diagnostics"("userHash");
CREATE INDEX "ai_diagnostics_locale_idx" ON "ai_diagnostics"("locale");
CREATE INDEX "ai_diagnostics_refused_idx" ON "ai_diagnostics"("refused");
