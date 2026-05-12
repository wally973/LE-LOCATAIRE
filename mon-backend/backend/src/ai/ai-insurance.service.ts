import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiInsuranceService {
  constructor(private readonly prisma: PrismaService) {}

  async checkTenantInsurance(tenantId: number) {
    const tenant = await this.prisma.tenantProfile.findUnique({
      where: { id: tenantId },
      include: {
        housing: true,
        user: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Locataire introuvable');
    }

    const documents = await this.prisma.document.findMany({
      where: {
        tenantId,
        type: 'ASSURANCE_HABITATION',
      },
      orderBy: { createdAt: 'desc' },
    });

    const hasInsurance = documents.length > 0;

    return {
      tenant: {
        id: tenant.id,
        name: `${tenant.firstName} ${tenant.lastName}`,
      },
      housing: tenant.housing
        ? {
            id: tenant.housing.id,
            address: tenant.housing.address,
            city: tenant.housing.city,
          }
        : null,
      insurance: {
        hasInsurance,
        lastDocument: hasInsurance ? documents[0] : null,
      },
    };
  }
}
