import { Injectable } from '@nestjs/common';
import { Prisma, TicketStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { BailleurScope } from '../../auth/scope/bailleur-scope.types';

const CLOSED_STATUSES: TicketStatus[] = ['RESOLVED', 'CANCELLED', 'AUTO_CLOSED'];

/** Libellés métier lisibles pour le référent (catégorie IA). */
const METIER_LABELS: Record<string, string> = {
  PLUMBING: 'Plomberie',
  ELECTRICITY: 'Électricité',
  HUMIDITY: 'Humidité',
  HEATING: 'Chauffage',
  LOCKSMITH: 'Serrurerie',
  CARPENTRY: 'Menuiserie',
  ROOFING: 'Toiture',
  SANITARY: 'Sanitaires',
  OTHER: 'Autre',
};

@Injectable()
export class AgentsReclamationsService {
  constructor(private readonly prisma: PrismaService) {}

  formatMetier(aiCategory: string | null, artisanType: string | null): string {
    const key = (aiCategory ?? artisanType ?? 'OTHER').toUpperCase();
    return METIER_LABELS[key] ?? key.replace(/_/g, ' ');
  }

  /** Jours sans action humaine — V1 : depuis la dernière mise à jour du ticket. */
  computeDaysUntreated(status: TicketStatus, updatedAt: Date, createdAt: Date): number {
    if (CLOSED_STATUSES.includes(status)) return 0;
    const ref = updatedAt ?? createdAt;
    const ms = Date.now() - ref.getTime();
    return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
  }

  formatRetard(days: number): { joursSansTraitement: number; affichageRetard: string } {
    if (days <= 0) {
      return { joursSansTraitement: 0, affichageRetard: '0' };
    }
    return { joursSansTraitement: days, affichageRetard: `+${days}` };
  }

  private ticketScopeWhere(
    landlordProfileId: number,
    agenceId?: number | null,
  ): Prisma.TicketWhereInput {
    const landlordFilter: Prisma.TicketWhereInput = {
      OR: [
        { landlordProfileId },
        { housing: { landlordId: landlordProfileId } },
      ],
    };

    if (agenceId != null) {
      return {
        AND: [landlordFilter, { housing: { agenceId } }],
      };
    }

    return landlordFilter;
  }

  async listForScope(scope: BailleurScope, onlyOpen = false) {
    if (!scope.landlordProfileId) {
      return { agence: null, items: [], total: 0 };
    }

    const agenceId =
      scope.role === 'AGENT' ? (scope.agenceId ?? null) : null;

    let agence: { id: number; name: string } | null = null;
    if (agenceId != null) {
      agence = await this.prisma.agence.findFirst({
        where: { id: agenceId, landlordProfileId: scope.landlordProfileId },
        select: { id: true, name: true },
      });
    }

    const where: Prisma.TicketWhereInput = {
      ...this.ticketScopeWhere(scope.landlordProfileId, agenceId),
      ...(onlyOpen && {
        status: { notIn: CLOSED_STATUSES },
      }),
    };

    const tickets = await this.prisma.ticket.findMany({
      where,
      orderBy: { updatedAt: 'asc' },
      include: {
        tenant: { select: { id: true, dossierNumber: true, firstName: true, lastName: true } },
        housing: {
          select: {
            id: true,
            address: true,
            city: true,
            postalCode: true,
            agenceId: true,
            agence: { select: { id: true, name: true } },
          },
        },
      },
    });

    const items = tickets.map((t) => {
      const days = this.computeDaysUntreated(t.status, t.updatedAt, t.createdAt);
      const retard = this.formatRetard(days);
      return {
        id: t.id,
        caseNumber: t.caseNumber,
        dossierNumber: t.tenant.dossierNumber,
        title: t.title,
        status: t.status,
        responsibility: t.responsibility,
        metier: this.formatMetier(t.aiCategory, t.aiSuggestedArtisanType),
        metierCode: t.aiCategory ?? t.aiSuggestedArtisanType,
        ...retard,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        tenant: {
          id: t.tenant.id,
          firstName: t.tenant.firstName,
          lastName: t.tenant.lastName,
        },
        housing: t.housing
          ? {
              id: t.housing.id,
              address: t.housing.address,
              city: t.housing.city,
              postalCode: t.housing.postalCode,
              agenceName: t.housing.agence?.name ?? null,
            }
          : null,
      };
    });

    items.sort((a, b) => b.joursSansTraitement - a.joursSansTraitement);

    return {
      agence,
      scopeLabel: agence?.name ?? 'Tout le bailleur',
      items,
      total: items.length,
    };
  }
}
