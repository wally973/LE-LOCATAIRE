import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateTenantProfileDto } from './dto/update-tenant-profile.dto';
import { DocumentType } from '@prisma/client';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: {
          include: {
            housing: {
              include: {
                landlord: { include: { user: { select: { id: true, email: true } } } },
              },
            },
          },
        },
      },
    });

    if (!user || user.role !== 'LOCATAIRE') {
      throw new ForbiddenException('Accès réservé aux locataires');
    }

    return user;
  }

  async updateProfile(userId: number, dto: UpdateTenantProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });

    if (!user || user.role !== 'LOCATAIRE' || !user.tenant) {
      throw new ForbiddenException('Accès réservé aux locataires');
    }

    if (dto.newPassword) {
      if (!dto.currentPassword) {
        throw new UnauthorizedException('Mot de passe actuel requis');
      }
      const ok = await bcrypt.compare(dto.currentPassword, user.password);
      if (!ok) {
        throw new UnauthorizedException('Mot de passe actuel incorrect');
      }
    }

    const hashed =
      dto.newPassword != null
        ? await bcrypt.hash(dto.newPassword, 10)
        : undefined;

    const nextFirst =
      dto.firstName !== undefined ? dto.firstName : user.tenant.firstName;
    const nextLast =
      dto.lastName !== undefined ? dto.lastName : user.tenant.lastName;

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(hashed !== undefined && { password: hashed }),
        ...(dto.firstName !== undefined || dto.lastName !== undefined
          ? {
              tenant: {
                update: {
                  firstName: nextFirst,
                  lastName: nextLast,
                },
              },
            }
          : {}),
      },
      include: { tenant: { include: { housing: true } } },
    });
  }

  async getDashboard(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: {
          include: {
            housing: {
              include: {
                landlord: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    if (!user || user.role !== 'LOCATAIRE' || !user.tenant) {
      throw new ForbiddenException('Accès réservé aux locataires');
    }

    const tp = user.tenant;

    const [openTickets, totalTickets, quittanceCount] = await Promise.all([
      this.prisma.ticket.count({
        where: {
          tenantId: tp.id,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
      }),
      this.prisma.ticket.count({ where: { tenantId: tp.id } }),
      this.prisma.document.count({
        where: {
          tenantId: tp.id,
          type: DocumentType.QUITTANCE_LOYER,
        },
      }),
    ]);

    return {
      profile: {
        firstName: tp.firstName,
        lastName: tp.lastName,
      },
      housing: tp.housing,
      stats: {
        openTickets,
        totalTickets,
        quittanceCount,
      },
    };
  }

  /**
   * Paiements côté locataire : quittances générées (Document QUITTANCE_LOYER).
   * D’autres sources (Stripe) pourront être fusionnées ici.
   */
  async listMyPayments(userId: number) {
    const tp = await this.prisma.tenantProfile.findUnique({
      where: { userId },
    });
    if (!tp) {
      throw new ForbiddenException('Profil locataire introuvable');
    }

    const docs = await this.prisma.document.findMany({
      where: {
        tenantId: tp.id,
        type: DocumentType.QUITTANCE_LOYER,
      },
      orderBy: { createdAt: 'desc' },
    });

    return docs.map((d) => ({
      id: d.id,
      kind: 'QUITTANCE_LOYER' as const,
      status: d.url ? 'AVAILABLE' : 'PENDING',
      createdAt: d.createdAt,
      label: 'Quittance de loyer',
      fileName: d.url ?? undefined,
    }));
  }

  async getMyPaymentDetail(userId: number, documentId: number) {
    const tp = await this.prisma.tenantProfile.findUnique({
      where: { userId },
    });
    if (!tp) {
      throw new ForbiddenException('Profil locataire introuvable');
    }

    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    if (
      !doc ||
      doc.tenantId !== tp.id ||
      doc.type !== DocumentType.QUITTANCE_LOYER
    ) {
      throw new NotFoundException('Quittance introuvable');
    }

    return {
      id: doc.id,
      kind: 'QUITTANCE_LOYER' as const,
      status: doc.url ? 'AVAILABLE' : 'PENDING',
      createdAt: doc.createdAt,
      label: 'Quittance de loyer',
      fileName: doc.url ?? undefined,
      content: doc.content,
      housingId: doc.housingId,
    };
  }
}
