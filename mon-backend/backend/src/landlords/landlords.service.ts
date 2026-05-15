import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LandlordUpdateProfileDto } from './dto/landlord-update-profile.dto';
import { ValidateHousingDto } from './dto/validate-housing.dto';

@Injectable()
export class LandlordsService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: number) {
    const landlord = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { landlord: true },
    });

    if (!landlord || landlord.role !== 'BAILLEUR') {
      throw new ForbiddenException('Accès réservé aux bailleurs');
    }

    return landlord;
  }

  async updateProfile(userId: number, dto: LandlordUpdateProfileDto) {
    const landlord = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { landlord: true },
    });

    if (!landlord || landlord.role !== 'BAILLEUR') {
      throw new ForbiddenException('Accès réservé aux bailleurs');
    }

    const nameFromParts = [dto.firstName, dto.lastName]
      .filter((x): x is string => typeof x === 'string' && x.length > 0)
      .join(' ')
      .trim();

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(nameFromParts.length > 0
          ? {
              landlord: {
                update: { name: nameFromParts },
              },
            }
          : {}),
      },
      include: { landlord: true },
    });
  }

  /** Parc immobilier : filtre sur l’id LandlordProfile, pas User.id */
  async getMyHousings(userId: number) {
    const lp = await this.prisma.landlordProfile.findUnique({
      where: { userId },
    });
    if (!lp) return [];

    return this.prisma.housing.findMany({
      where: { landlordId: lp.id },
      include: {
        currentTenant: {
          include: {
            user: { select: { email: true, phone: true } },
          },
        },
        tickets: true,
      },
    });
  }

  async validateHousing(
    housingId: number,
    dto: ValidateHousingDto,
    userId: number,
  ) {
    const housing = await this.prisma.housing.findUnique({
      where: { id: housingId },
    });

    if (!housing) {
      throw new NotFoundException('Logement introuvable');
    }

    const lp = await this.prisma.landlordProfile.findUnique({
      where: { userId },
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    const isAdmin = user?.role === 'ADMIN';
    const isOwner = lp != null && housing.landlordId === lp.id;

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('Vous ne pouvez pas valider ce logement');
    }

    return this.prisma.housing.update({
      where: { id: housingId },
      data: {
        isValidated: dto.isValidated,
        validationComment: dto.comment ?? null,
      },
    });
  }

  async getMyTickets(userId: number) {
    const lp = await this.prisma.landlordProfile.findUnique({
      where: { userId },
    });
    if (!lp) return [];

    return this.prisma.ticket.findMany({
      where: {
        housing: { landlordId: lp.id },
      },
      include: {
        tenant: true,
        planningSlots: {
          include: {
            artisan: true,
          },
        },
        housing: true,
        documents: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMyArtisans(userId: number) {
    const lp = await this.prisma.landlordProfile.findUnique({
      where: { userId },
    });
    if (!lp) return [];

    return this.prisma.user.findMany({
      where: {
        role: 'PRESTATAIRE',
        planningSlots: {
          some: {
            ticket: {
              housing: {
                landlordId: lp.id,
              },
            },
          },
        },
      },
      include: {
        planningSlots: {
          include: {
            ticket: {
              include: {
                housing: true,
              },
            },
          },
        },
      },
    });
  }
}
