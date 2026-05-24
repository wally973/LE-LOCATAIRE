import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { GPA_STANDARD_DURATION_MONTHS } from '../knowledge/lia-occupancy-context';

/** Dates GPA / garanties résidence pour le brief bibliothécaire. */
@Injectable()
export class LiaHousingWarrantyService {
  constructor(private readonly prisma: PrismaService) {}

  async buildWarrantyBlock(housingId: number): Promise<string> {
    const housing = await this.prisma.housing.findUnique({
      where: { id: housingId },
      select: {
        hlmLogementId: true,
        hlmLogement: {
          select: {
            residence: {
              select: {
                name: true,
                residenceNeuve: true,
                deliveryDate: true,
                gpaEndDate: true,
                biennaleEndDate: true,
                decennaleEndDate: true,
              },
            },
          },
        },
      },
    });
    const residence = housing?.hlmLogement?.residence;
    if (!residence) {
      return 'Garanties résidence : non renseignées (pas de lien patrimoine HLM sur ce logement).';
    }

    const now = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const gpaActive = residence.gpaEndDate >= now;
    const lines = [
      `Résidence : ${residence.name}`,
      residence.residenceNeuve ? 'Résidence neuve : oui' : 'Résidence neuve : non',
      `Livraison : ${fmt(residence.deliveryDate)}`,
      `GPA jusqu’au ${fmt(residence.gpaEndDate)} (${GPA_STANDARD_DURATION_MONTHS} mois type) — ${gpaActive ? 'EN COURS' : 'expirée'}`,
      `Biennale jusqu’au ${fmt(residence.biennaleEndDate)}`,
      `Décennale jusqu’au ${fmt(residence.decennaleEndDate)}`,
    ];
    if (gpaActive && residence.residenceNeuve) {
      lines.push(
        'Piste : défaut sur remise en état neuve → prioriser GPA avant charge locataire / entretien courant',
      );
    }
    return lines.join('\n');
  }
}
