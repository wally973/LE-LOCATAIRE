import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { HlmTicket } from '@prisma/client';
import {
  HlmTicketCategory,
  HlmTicketStatus,
  HlmTicketUrgency,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateHlmTicketInput } from '../dto/hlm-input.dto';
import type { HlmTicketDto } from '../dto/hlm-shared.dto';
import { HlmPreuveService } from '../preuves/hlm-preuve.service';
import {
  computeRoutingTarget,
  resolveWarrantyPhaseAtDate,
} from '../utils/hlm-warranty.util';

/** Catégories pour lesquelles des preuves d’entretien extérieur sont exigées avant ticket. */
const OUTDOOR_MAINTENANCE_CATEGORIES: HlmTicketCategory[] = [
  HlmTicketCategory.MOUSTIQUES,
  HlmTicketCategory.NUISIBLE,
  HlmTicketCategory.EVACUATION,
  HlmTicketCategory.INFILTRATION,
  HlmTicketCategory.ODEUR,
];

@Injectable()
export class HlmTicketService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly preuveService: HlmPreuveService,
  ) {}

  async createTicket(dto: CreateHlmTicketInput): Promise<HlmTicketDto> {
    const logement = await this.prisma.hlmLogement.findUnique({
      where: { id: dto.logementId },
      include: {
        residence: { include: { bailleur: true } },
      },
    });
    if (!logement) throw new NotFoundException(`Logement introuvable`);

    if (dto.locataireId) {
      const loc = await this.prisma.hlmLocataire.findUnique({
        where: { id: dto.locataireId },
      });
      if (!loc) throw new NotFoundException(`Locataire introuvable`);
    }

    const block = await this.blockIfMaintenanceMissing(
      dto.logementId,
      dto.category,
    );

    const row = await this.prisma.hlmTicket.create({
      data: {
        title: dto.title,
        description: dto.description ?? null,
        category: dto.category,
        urgency: dto.urgency ?? HlmTicketUrgency.NORMALE,
        status: dto.status ?? HlmTicketStatus.BROUILLON,
        logementId: dto.logementId,
        locataireId: dto.locataireId ?? null,
        routingNotes: dto.routingNotes ?? null,
        entretienBlocked: block.blocked,
        blockedReason: block.reason ?? null,
      },
    });

    const routed = await this.routeTicket(row.id);
    return routed;
  }

  async routeTicket(ticketId: string): Promise<HlmTicketDto> {
    const ticket = await this.prisma.hlmTicket.findUnique({
      where: { id: ticketId },
      include: {
        logement: {
          include: {
            residence: { include: { bailleur: true } },
          },
        },
      },
    });
    if (!ticket) throw new NotFoundException(`Ticket introuvable`);

    const delivery = ticket.logement.residence.deliveryDate;
    const phase = resolveWarrantyPhaseAtDate(delivery, new Date());
    const routing = computeRoutingTarget({
      phase,
      residenceHasInternalGpa:
        ticket.logement.residence.hasInternalGPAServicePerResidence,
      bailleurHasInternalGpa:
        ticket.logement.residence.bailleur.hasInternalGPAService,
    });

    const updated = await this.prisma.hlmTicket.update({
      where: { id: ticketId },
      data: {
        warrantyPhaseAtCreation: phase,
        routingTarget: routing,
      },
    });
    return this.toDto(updated);
  }

  /**
   * Si la catégorie impose des entretiens privatifs et qu’aucune preuve récente n’existe : blocage.
   */
  async blockIfMaintenanceMissing(
    logementId: string,
    categorie: HlmTicketCategory,
  ): Promise<{ blocked: boolean; reason?: string }> {
    if (!OUTDOOR_MAINTENANCE_CATEGORIES.includes(categorie)) {
      return { blocked: false };
    }

    const logement = await this.prisma.hlmLogement.findUnique({
      where: { id: logementId },
    });
    if (!logement) throw new NotFoundException(`Logement introuvable`);

    const hasOutdoor =
      logement.hasCour ||
      logement.hasJardin ||
      logement.hasTerrasse ||
      logement.hasPatio;

    if (!hasOutdoor) {
      return {
        blocked: true,
        reason:
          'Ce problème semble lié à un entretien non effectué. Merci d’envoyer vos preuves d’entretien (espaces extérieurs non déclarés sur la fiche logement).',
      };
    }

    const ok = await this.preuveService.hasRecentValidatedOutdoorProof(
      logementId,
    );
    if (!ok) {
      return {
        blocked: true,
        reason:
          'Ce problème semble lié à un entretien non effectué. Merci d’envoyer vos preuves d’entretien.',
      };
    }
    return { blocked: false };
  }

  async listTickets(): Promise<HlmTicketDto[]> {
    const rows = await this.prisma.hlmTicket.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  async getTicket(id: string): Promise<HlmTicketDto> {
    const row = await this.prisma.hlmTicket.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Ticket introuvable`);
    return this.toDto(row);
  }

  private toDto(r: HlmTicket): HlmTicketDto {
    return {
      reference: r.id,
      title: r.title,
      description: r.description,
      category: r.category,
      urgency: r.urgency,
      status: r.status,
      warrantyPhase: r.warrantyPhaseAtCreation,
      routingTarget: r.routingTarget,
      routingNotes: r.routingNotes,
      maintenanceBlocked: r.entretienBlocked,
      blockedReason: r.blockedReason,
      logementReference: r.logementId,
      locataireReference: r.locataireId,
      createdAtIso: r.createdAt.toISOString(),
      updatedAtIso: r.updatedAt.toISOString(),
    };
  }
}
