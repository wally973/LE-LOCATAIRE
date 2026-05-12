import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiLegalService {
  constructor(private readonly prisma: PrismaService) {}

  async checkHousingCompliance(housingId: number) {
    const housing = await this.prisma.housing.findUnique({
      where: { id: housingId },
      include: {
        landlord: {
          include: { user: true },
        },
        currentTenant: {
          include: { user: true },
        },
        documents: true,
      },
    });

    if (!housing) {
      throw new NotFoundException('Logement introuvable');
    }

    const hasContract = housing.documents.some(
      (d) => d.type === 'CONTRAT_LOCATION',
    );

    const hasInsurance = housing.documents.some(
      (d) => d.type === 'ASSURANCE_HABITATION',
    );

    return {
      housing: {
        id: housing.id,
        address: housing.address,
        city: housing.city,
      },
      landlord: housing.landlord
        ? {
            id: housing.landlord.id,
            name: housing.landlord.name,
          }
        : null,
      tenant: housing.currentTenant
        ? {
            id: housing.currentTenant.id,
            name: `${housing.currentTenant.firstName} ${housing.currentTenant.lastName}`,
          }
        : null,
      compliance: {
        hasContract,
        hasInsurance,
      },
    };
  }
}
