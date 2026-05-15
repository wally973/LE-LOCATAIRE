import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  TicketResponsibility,
  TicketStatus,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LandlordUpdateProfileDto } from './dto/landlord-update-profile.dto';
import { ValidateHousingDto } from './dto/validate-housing.dto';
import type {
  LandlordDashboardResponse,
  LandlordDashboardTicketRow,
} from './landlord-dashboard.types';

const OPEN_TICKET_STATUSES: TicketStatus[] = [
  'NEW',
  'AWAITING_TENANT_PHOTO',
  'OPEN',
  'IN_PROGRESS',
];

const ALL_RESPONSIBILITIES = Object.values(
  TicketResponsibility,
) as TicketResponsibility[];

const ticketSummarySelect = {
  id: true,
  title: true,
  status: true,
  responsibility: true,
  aiCategory: true,
  aiConfidence: true,
  escalatedAt: true,
  escalationReason: true,
  aiAttempts: true,
  createdAt: true,
  housing: { select: { id: true, address: true } },
  tenant: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.TicketSelect;

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

  /** Filtre tickets du parc (landlordProfileId ou logement rattaché). */
  private ticketScopeWhere(
    landlordProfileId: number,
  ): Prisma.TicketWhereInput {
    return {
      OR: [
        { landlordProfileId },
        { housing: { landlordId: landlordProfileId } },
      ],
    };
  }

  /**
   * Tableau de bord bailleur — KPI parc, répartition IA / responsabilité, escalades.
   */
  async getDashboard(
    landlordProfileId: number,
  ): Promise<LandlordDashboardResponse> {
    const lp = await this.prisma.landlordProfile.findUnique({
      where: { id: landlordProfileId },
      select: { id: true, name: true, userId: true },
    });
    if (!lp) {
      throw new NotFoundException('Profil bailleur introuvable');
    }

    const ticketWhere = this.ticketScopeWhere(lp.id);

    const [
      housings,
      openTickets,
      respGroups,
      statusGroups,
      escalationsActive,
      awaitingAi,
      recentEscalations,
      recentTickets,
      routedCount,
      pendingAnalysis,
      nonRecevableCount,
      confidenceAgg,
      categoryGroups,
      severityGroups,
      invoices,
    ] = await Promise.all([
      this.prisma.housing.findMany({
        where: { landlordId: lp.id },
        select: { id: true, currentTenant: { select: { id: true } } },
      }),
      this.prisma.ticket.count({
        where: { ...ticketWhere, status: { in: OPEN_TICKET_STATUSES } },
      }),
      this.prisma.ticket.groupBy({
        by: ['responsibility'],
        where: ticketWhere,
        _count: { _all: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['status'],
        where: ticketWhere,
        _count: { _all: true },
      }),
      this.prisma.ticket.count({
        where: {
          ...ticketWhere,
          responsibility: 'ESCALADE_BAILLEUR',
          status: { notIn: ['RESOLVED', 'CANCELLED'] },
        },
      }),
      this.prisma.ticket.count({
        where: { ...ticketWhere, responsibility: 'PENDING' },
      }),
      this.prisma.ticket.findMany({
        where: {
          ...ticketWhere,
          OR: [
            { responsibility: 'ESCALADE_BAILLEUR' },
            { escalatedAt: { not: null } },
          ],
          status: { notIn: ['RESOLVED', 'CANCELLED'] },
        },
        select: ticketSummarySelect,
        orderBy: [{ escalatedAt: 'desc' }, { createdAt: 'desc' }],
        take: 10,
      }),
      this.prisma.ticket.findMany({
        where: ticketWhere,
        select: ticketSummarySelect,
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      this.prisma.ticket.count({
        where: {
          ...ticketWhere,
          responsibility: { not: 'PENDING' },
        },
      }),
      this.prisma.ticket.count({
        where: { ...ticketWhere, responsibility: 'PENDING' },
      }),
      this.prisma.ticket.count({
        where: { ...ticketWhere, responsibility: 'NON_RECEVABLE' },
      }),
      this.prisma.ticket.aggregate({
        where: { ...ticketWhere, aiConfidence: { not: null } },
        _avg: { aiConfidence: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['aiCategory'],
        where: { ...ticketWhere, aiCategory: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['aiSeverity'],
        where: { ...ticketWhere, aiSeverity: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.invoice.findMany({
        where: { landlordId: lp.userId },
        select: { status: true },
      }),
    ]);

    const tenantIds = new Set<number>();
    for (const h of housings) {
      if (h.currentTenant?.id != null) tenantIds.add(h.currentTenant.id);
    }

    const ticketsByResponsibility = ALL_RESPONSIBILITIES.reduce(
      (acc, key) => {
        acc[key] = 0;
        return acc;
      },
      {} as Record<TicketResponsibility, number>,
    );
    for (const row of respGroups) {
      ticketsByResponsibility[row.responsibility] = row._count._all;
    }

    const ticketsByStatus: Partial<Record<TicketStatus, number>> = {};
    for (const row of statusGroups) {
      ticketsByStatus[row.status] = row._count._all;
    }

    const byCategory: Record<string, number> = {};
    for (const row of categoryGroups) {
      if (row.aiCategory) byCategory[row.aiCategory] = row._count._all;
    }

    const bySeverity: Record<string, number> = {};
    for (const row of severityGroups) {
      if (row.aiSeverity) bySeverity[row.aiSeverity] = row._count._all;
    }

    const paid = invoices.filter((i) => i.status === 'PAID').length;
    const pending = invoices.filter((i) => i.status === 'PENDING').length;

    return {
      profile: {
        landlordProfileId: lp.id,
        name: lp.name,
      },
      stats: {
        housingCount: housings.length,
        tenantCount: tenantIds.size,
        openTickets,
        invoices: {
          total: invoices.length,
          paid,
          pending,
          unpaid: invoices.length - paid,
        },
      },
      ticketsByResponsibility,
      ticketsByStatus,
      escalations: {
        active: escalationsActive,
        awaitingAi,
        recent: recentEscalations as LandlordDashboardTicketRow[],
      },
      ai: {
        routedCount,
        avgConfidence: confidenceAgg._avg.aiConfidence,
        pendingAnalysis,
        nonRecevableCount,
        byCategory,
        bySeverity,
      },
      recentTickets: recentTickets as LandlordDashboardTicketRow[],
    };
  }

  async getMyTicketsByLandlordProfile(
    landlordProfileId: number,
    filters?: { responsibility?: TicketResponsibility },
  ) {
    const where: Prisma.TicketWhereInput = {
      ...this.ticketScopeWhere(landlordProfileId),
      ...(filters?.responsibility && {
        responsibility: filters.responsibility,
      }),
    };

    return this.prisma.ticket.findMany({
      where,
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

  async getMyTickets(
    userId: number,
    filters?: { responsibility?: TicketResponsibility },
  ) {
    const lp = await this.prisma.landlordProfile.findUnique({
      where: { userId },
    });
    if (!lp) return [];
    return this.getMyTicketsByLandlordProfile(lp.id, filters);
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
