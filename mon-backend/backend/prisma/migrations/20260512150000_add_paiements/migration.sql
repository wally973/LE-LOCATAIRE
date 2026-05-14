-- CreateTable
CREATE TABLE "Paiement" (
    "id" SERIAL NOT NULL,
    "contratId" INTEGER NOT NULL,
    "datePaiement" TIMESTAMP(3) NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "moyenPaiement" TEXT NOT NULL,
    "statut" TEXT NOT NULL,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Paiement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Paiement_reference_key" ON "Paiement"("reference");

-- CreateIndex
CREATE INDEX "Paiement_contratId_idx" ON "Paiement"("contratId");

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "ContratLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
