-- CreateTable
CREATE TABLE "ContratLocation" (
    "id" SERIAL NOT NULL,
    "bailleurId" INTEGER NOT NULL,
    "locataireId" INTEGER NOT NULL,
    "bienId" INTEGER NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3),
    "loyerMensuel" DOUBLE PRECISION NOT NULL,
    "depotGarantie" DOUBLE PRECISION,
    "statut" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContratLocation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ContratLocation" ADD CONSTRAINT "ContratLocation_bailleurId_fkey" FOREIGN KEY ("bailleurId") REFERENCES "Bailleur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratLocation" ADD CONSTRAINT "ContratLocation_locataireId_fkey" FOREIGN KEY ("locataireId") REFERENCES "Locataire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratLocation" ADD CONSTRAINT "ContratLocation_bienId_fkey" FOREIGN KEY ("bienId") REFERENCES "BienImmobilier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "ContratLocation_bailleurId_idx" ON "ContratLocation"("bailleurId");

-- CreateIndex
CREATE INDEX "ContratLocation_locataireId_idx" ON "ContratLocation"("locataireId");

-- CreateIndex
CREATE INDEX "ContratLocation_bienId_idx" ON "ContratLocation"("bienId");
