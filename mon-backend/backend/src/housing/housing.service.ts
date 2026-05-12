import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHousingDto } from './dto/create-housing.dto';
import { UpdateHousingDto } from './dto/update-housing.dto';
import { AssignTenantDto } from './dto/assign-tenant.dto';

@Injectable()
export class HousingService {
  constructor(private prisma: PrismaService) {}

  // TERRITORIALISATION GUYANE
  private ensureIsInGuyane(city: string) {
    const allowedCities = [
      'Cayenne',
      'Matoury',
      'Rémire-Montjoly',
      'Kourou',
      'Saint-Laurent-du-Maroni',
      'Macouria',
      'Mana',
      'Maripasoula',
      'Apatou',
      'Grand-Santi',
      'Camopi',
      'Papaïchton',
      'Iracoubo',
      'Montsinéry-Tonnegrande',
      'Ouanary',
      'Roura',
      'Saint-Georges',
      'Sinnamary',
      'Awala-Yalimapo'
    ];

    if (!allowedCities.includes(city)) {
      throw new BadRequestException(
        `Ce logement n'est pas situé en Guyane. Ville reçue : ${city}`
      );
    }
  }

  private mapCityToEnum(city: string) {
    switch (city) {
      case 'Cayenne':
        return 'CAYENNE';
      case 'Matoury':
        return 'MATOURY';
      case 'Kourou':
        return 'KOUROU';
      case 'Saint-Laurent-du-Maroni':
        return 'SAINT_LAURENT';
      default:
        return 'AUTRE_GUYANE';
    }
  }

  // CRÉATION D’UN LOGEMENT
  async create(dto: CreateHousingDto) {
    this.ensureIsInGuyane(dto.city);

    return this.prisma.housing.create({
      data: {
        address: dto.address,
        city: this.mapCityToEnum(dto.city) as any,
        postalCode: dto.postalCode,
        landlordId: dto.landlordId,
      },
    });
  }

  // RÉCUPÉRER TOUS LES LOGEMENTS
  async findAll() {
    return this.prisma.housing.findMany({
      include: {
        landlord: true,
        currentTenant: true,
      },
    });
  }

  // RÉCUPÉRER UN LOGEMENT PAR ID
  async findOne(id: number) {
    const housing = await this.prisma.housing.findUnique({
      where: { id },
      include: {
        landlord: true,
        currentTenant: true,
      },
    });

    if (!housing) {
      throw new NotFoundException('Logement introuvable');
    }

    return housing;
  }

  // MISE À JOUR D’UN LOGEMENT
  async update(id: number, dto: UpdateHousingDto) {
    const housing = await this.prisma.housing.findUnique({ where: { id } });
    if (!housing) throw new NotFoundException('Logement introuvable');

    if (dto.city) {
      this.ensureIsInGuyane(dto.city);
    }

    const updateData: any = { ...dto };
    if (dto.city) {
      updateData.city = this.mapCityToEnum(dto.city);
    }

    return this.prisma.housing.update({
      where: { id },
      data: updateData,
    });
  }

  // SUPPRESSION D’UN LOGEMENT
  async remove(id: number) {
    const housing = await this.prisma.housing.findUnique({ where: { id } });
    if (!housing) throw new NotFoundException('Logement introuvable');

    return this.prisma.housing.delete({ where: { id } });
  }

  // ASSIGNER UN LOCATAIRE À UN LOGEMENT
  async assignTenant(dto: AssignTenantDto) {
    const housing = await this.prisma.housing.findUnique({
      where: { id: dto.housingId },
    });

    if (!housing) {
      throw new NotFoundException('Logement introuvable');
    }

    const tenant = await this.prisma.tenantProfile.findUnique({
      where: { userId: dto.tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Locataire introuvable');
    }

    // ANTI-FRAUDE : un locataire ne peut être assigné qu’à un seul logement
    const alreadyAssigned = await this.prisma.tenantProfile.findFirst({
      where: { housingId: dto.housingId },
    });

    if (alreadyAssigned) {
      throw new BadRequestException(
        `Ce logement a déjà un locataire assigné`
      );
    }

    return this.prisma.tenantProfile.update({
      where: { userId: dto.tenantId },
      data: {
        housingId: dto.housingId,
      },
    });
  }
}
