-- CreateTable
CREATE TABLE "BienImmobilier" (
    "id" SERIAL NOT NULL,
    "titre" TEXT NOT NULL,
    "adresse" TEXT NOT NULL,
    "ville" TEXT NOT NULL,
    "codePostal" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "surface" DOUBLE PRECISION,
    "loyer" DOUBLE PRECISION,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BienImmobilier_pkey" PRIMARY KEY ("id")
);
