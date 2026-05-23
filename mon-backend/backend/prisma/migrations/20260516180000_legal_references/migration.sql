-- Références juridiques structurées (offline / RAG)
CREATE TYPE "LegalReferenceKind" AS ENUM (
  'LOI',
  'DECRET',
  'CODE_CIVIL',
  'ARRETE',
  'FICHE_SP',
  'FICHE_METIER',
  'FAQ'
);

CREATE TABLE "LegalReference" (
    "slug" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "kind" "LegalReferenceKind" NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "responsibilityHint" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sources" JSONB NOT NULL,
    "exceptions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalReference_pkey" PRIMARY KEY ("slug")
);

CREATE INDEX "LegalReference_category_idx" ON "LegalReference"("category");
CREATE INDEX "LegalReference_kind_idx" ON "LegalReference"("kind");
