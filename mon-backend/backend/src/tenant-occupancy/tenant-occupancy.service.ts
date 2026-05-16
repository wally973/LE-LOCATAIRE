import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Motif de fin d'occupation enregistré par défaut. */
export const MOVE_OUT_ETAT_DES_LIEUX = 'ETAT_DES_LIEUX_SORTIE';

/**
 * Historique d'occupation : le DOS locataire ne change pas ;
 * chaque logement a son immatriculation LOG-…
 */
@Injectable()
export class TenantOccupancyService {
  constructor(private readonly prisma: PrismaService) {}

  formatResidenceUnitNumber(housingId: number, postalCode: string): string {
    const cp = postalCode.replace(/\s/g, '').slice(0, 5);
    return `LOG-${cp}-${String(housingId).padStart(6, '0')}`;
  }

  async ensureHousingUnitNumber(housingId: number): Promise<string> {
    const h = await this.prisma.housing.findUnique({
      where: { id: housingId },
      select: { id: true, postalCode: true, residenceUnitNumber: true },
    });
    if (!h) throw new Error('Logement introuvable');
    if (h.residenceUnitNumber) return h.residenceUnitNumber;

    const residenceUnitNumber = this.formatResidenceUnitNumber(
      h.id,
      h.postalCode,
    );
    await this.prisma.housing.update({
      where: { id: housingId },
      data: { residenceUnitNumber },
    });
    return residenceUnitNumber;
  }

  /** Début d'occupation (première entrée ou nouveau logement). */
  async recordMoveIn(
    tenantProfileId: number,
    housingId: number,
    from: Date = new Date(),
  ) {
    await this.ensureHousingUnitNumber(housingId);

    const open = await this.prisma.tenantHousingHistory.findFirst({
      where: { tenantId: tenantProfileId, housingId, to: null },
    });
    if (open) return open;

    return this.prisma.tenantHousingHistory.create({
      data: {
        tenantId: tenantProfileId,
        housingId,
        from,
      },
    });
  }

  /**
   * Fin d'occupation d'un logement (état des lieux de sortie).
   * Le numéro de dossier locataire (DOS) est inchangé.
   */
  async recordMoveOut(
    tenantProfileId: number,
    housingId: number,
    moveOutDate: Date,
    moveOutReason: string = MOVE_OUT_ETAT_DES_LIEUX,
  ) {
    const open = await this.prisma.tenantHousingHistory.findFirst({
      where: { tenantId: tenantProfileId, housingId, to: null },
      orderBy: { from: 'desc' },
    });
    if (!open) {
      return this.prisma.tenantHousingHistory.create({
        data: {
          tenantId: tenantProfileId,
          housingId,
          from: moveOutDate,
          to: moveOutDate,
          moveOutReason,
        },
      });
    }
    return this.prisma.tenantHousingHistory.update({
      where: { id: open.id },
      data: { to: moveOutDate, moveOutReason },
    });
  }

  /**
   * Changement de logement chez le même bailleur : clôture l'ancien, ouvre le nouveau.
   */
  async changeHousing(params: {
    tenantProfileId: number;
    previousHousingId: number | null;
    newHousingId: number;
    moveOutDate: Date;
    moveInDate?: Date;
  }) {
    const moveInDate = params.moveInDate ?? params.moveOutDate;

    if (
      params.previousHousingId != null &&
      params.previousHousingId !== params.newHousingId
    ) {
      await this.recordMoveOut(
        params.tenantProfileId,
        params.previousHousingId,
        params.moveOutDate,
      );
    }

    await this.prisma.tenantProfile.update({
      where: { id: params.tenantProfileId },
      data: { housingId: params.newHousingId },
    });

    await this.recordMoveIn(
      params.tenantProfileId,
      params.newHousingId,
      moveInDate,
    );
  }

  async getOccupancyHistory(tenantProfileId: number) {
    return this.prisma.tenantHousingHistory.findMany({
      where: { tenantId: tenantProfileId },
      orderBy: { from: 'desc' },
      include: {
        housing: {
          select: {
            id: true,
            address: true,
            city: true,
            postalCode: true,
            residenceUnitNumber: true,
          },
        },
      },
    });
  }
}
