import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, TenantRequestStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import { ApproveTenantRequestDto } from './dto/approve-tenant-request.dto';
import { RejectTenantRequestDto } from './dto/reject-tenant-request.dto';
import { TenantOccupancyService } from '../tenant-occupancy/tenant-occupancy.service';

const requestInclude = {
  user: {
    select: { id: true, email: true, phone: true, isAvailable: true, role: true },
  },
  landlord: { select: { id: true, name: true } },
  approvedTenantProfile: { select: { id: true, firstName: true, lastName: true } },
  approvedHousing: {
    select: { id: true, address: true, city: true, postalCode: true },
  },
} as const;

@Injectable()
export class TenantOnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly occupancy: TenantOccupancyService,
  ) {}

  /**
   * Inscription self-service publique. Crée :
   * - un `User` LOCATAIRE désactivé (`isAvailable = false`) en attente de validation
   * - une `TenantRegistrationRequest` PENDING rattachée au bailleur choisi
   * - une notification interne pour le bailleur
   */
  async registerTenant(dto: RegisterTenantDto) {
    const landlord = await this.prisma.landlordProfile.findUnique({
      where: { id: dto.landlordProfileId },
      select: { id: true, userId: true, name: true },
    });
    if (!landlord) {
      throw new BadRequestException('Bailleur introuvable');
    }

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ phone: dto.phone }, dto.email ? { email: dto.email } : { id: -1 }],
      },
    });
    if (existing) {
      throw new ConflictException(
        'Un compte existe déjà avec cet email ou ce numéro',
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Création atomique : User + Request + Notification.
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          phone: dto.phone,
          email: dto.email,
          password: hashedPassword,
          role: Role.LOCATAIRE,
          isAvailable: false,
        },
      });

      const request = await tx.tenantRegistrationRequest.create({
        data: {
          userId: user.id,
          landlordProfileId: dto.landlordProfileId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          address: dto.address,
          building: dto.building ?? null,
          floor: dto.floor ?? null,
          apartmentNumber: dto.apartmentNumber ?? null,
          postalCode: dto.postalCode,
          city: dto.city,
          contractStartDate: dto.contractStartDate
            ? new Date(dto.contractStartDate)
            : null,
          status: TenantRequestStatus.PENDING,
        },
        include: requestInclude,
      });

      await tx.notification.create({
        data: {
          userId: landlord.userId,
          type: 'TENANT_REQUEST_RECEIVED',
          title: 'Nouvelle demande locataire',
          message: `${dto.firstName} ${dto.lastName} souhaite être rattaché à votre parc (${dto.address}, ${dto.city}).`,
        },
      });

      return {
        message:
          'Inscription enregistrée. Votre compte sera activé après validation par le bailleur.',
        requestId: request.id,
        status: request.status,
      };
    });
  }

  /** Liste les demandes du bailleur (filtrable par status). */
  async listForLandlord(
    landlordProfileId: number,
    status?: TenantRequestStatus,
  ) {
    return this.prisma.tenantRegistrationRequest.findMany({
      where: {
        landlordProfileId,
        ...(status && { status }),
      },
      orderBy: { createdAt: 'desc' },
      include: requestInclude,
    });
  }

  async getOneForLandlord(landlordProfileId: number, id: number) {
    const row = await this.prisma.tenantRegistrationRequest.findUnique({
      where: { id },
      include: requestInclude,
    });
    if (!row || row.landlordProfileId !== landlordProfileId) {
      throw new NotFoundException(`Demande #${id} introuvable`);
    }
    return row;
  }

  /**
   * Approbation par le bailleur (ou agent).
   *
   * Effets atomiques :
   *   1. Crée un `TenantProfile` lié à l'utilisateur LOCATAIRE
   *   2. Lie ce profil à un `Housing` (existant via `housingId` ou créé à la volée)
   *   3. Active l'utilisateur (`isAvailable = true`)
   *   4. Marque la demande APPROVED + renseigne approvedHousingId / approvedTenantProfileId
   *   5. Notifie le locataire
   */
  async approve(
    landlordProfileId: number,
    id: number,
    dto: ApproveTenantRequestDto,
  ) {
    const request = await this.getOneForLandlord(landlordProfileId, id);
    if (request.status !== TenantRequestStatus.PENDING) {
      throw new BadRequestException('Cette demande a déjà été traitée');
    }

    let targetHousingId = dto.housingId;
    if (targetHousingId !== undefined) {
      const housing = await this.prisma.housing.findUnique({
        where: { id: targetHousingId },
        select: { id: true, landlordId: true, currentTenant: { select: { id: true } } },
      });
      if (!housing) {
        throw new BadRequestException('Logement introuvable');
      }
      if (housing.landlordId !== landlordProfileId) {
        throw new BadRequestException(
          'Ce logement n’appartient pas à votre parc',
        );
      }
      if (housing.currentTenant) {
        throw new ConflictException(
          'Ce logement est déjà occupé par un autre locataire',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // Création éventuelle d'un Housing à partir du snapshot d'adresse
      let housingId = targetHousingId;
      if (housingId === undefined) {
        const created = await tx.housing.create({
          data: {
            landlordId: landlordProfileId,
            agenceId: dto.agenceId ?? null,
            address: this.formatHousingAddress(request),
            city: request.city,
            postalCode: request.postalCode,
            isInGuyane: true,
          },
        });
        housingId = created.id;
      }

      // Création du TenantProfile lié au User et au Housing
      const tenantProfile = await tx.tenantProfile.create({
        data: {
          userId: request.userId,
          housingId,
          firstName: request.firstName,
          lastName: request.lastName,
          isOfficialTenant: true,
        },
      });

      await tx.tenantProfile.update({
        where: { id: tenantProfile.id },
        data: {
          dossierNumber: `DOS-${String(tenantProfile.id).padStart(6, '0')}`,
        },
      });

      // Activation du compte locataire
      await tx.user.update({
        where: { id: request.userId },
        data: { isAvailable: true },
      });

      // Mise à jour de la demande
      const updated = await tx.tenantRegistrationRequest.update({
        where: { id: request.id },
        data: {
          status: TenantRequestStatus.APPROVED,
          approvedAt: new Date(),
          approvedTenantProfileId: tenantProfile.id,
          approvedHousingId: housingId,
        },
        include: requestInclude,
      });

      // Notification au locataire
      await tx.notification.create({
        data: {
          userId: request.userId,
          type: 'TENANT_REQUEST_APPROVED',
          title: 'Votre compte est validé',
          message:
            'Votre bailleur a validé votre inscription. Vous pouvez désormais vous connecter à l’application.',
        },
      });

      return updated;
    }).then(async (updated) => {
      if (updated.approvedTenantProfileId && updated.approvedHousingId) {
        await this.occupancy.ensureHousingUnitNumber(updated.approvedHousingId);
        await this.occupancy.recordMoveIn(
          updated.approvedTenantProfileId,
          updated.approvedHousingId,
          updated.approvedAt ?? new Date(),
        );
      }
      return updated;
    });
  }

  /** Refus par le bailleur — motif obligatoire. */
  async reject(
    landlordProfileId: number,
    id: number,
    dto: RejectTenantRequestDto,
  ) {
    const request = await this.getOneForLandlord(landlordProfileId, id);
    if (request.status !== TenantRequestStatus.PENDING) {
      throw new BadRequestException('Cette demande a déjà été traitée');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.tenantRegistrationRequest.update({
        where: { id: request.id },
        data: {
          status: TenantRequestStatus.REJECTED,
          rejectedAt: new Date(),
          rejectionReason: dto.reason,
        },
        include: requestInclude,
      });

      // Notification au locataire
      await tx.notification.create({
        data: {
          userId: request.userId,
          type: 'TENANT_REQUEST_REJECTED',
          title: 'Demande d’inscription refusée',
          message: dto.reason,
        },
      });

      return updated;
    });
  }

  /** Compose une adresse postale lisible à partir du snapshot d'une demande. */
  private formatHousingAddress(
    request: Prisma.TenantRegistrationRequestGetPayload<{ include: typeof requestInclude }>,
  ): string {
    const parts: string[] = [request.address];
    if (request.building) parts.push(`Bât. ${request.building}`);
    if (request.floor) parts.push(`Étage ${request.floor}`);
    if (request.apartmentNumber) parts.push(`Appt ${request.apartmentNumber}`);
    return parts.join(' - ');
  }
}
