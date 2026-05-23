import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketStatus } from '@prisma/client';
import { AiPhotoService } from '../ai/ai-photo.service';
import { LiaOrchestratorService } from '../lia/lia-orchestrator.service';
import { LiaConversationService } from '../lia/lia-conversation.service';
import { CaseReferenceService } from './case-reference.service';
import { TenantOccupancyService } from '../tenant-occupancy/tenant-occupancy.service';
import { buildLandlordInfoEvents } from '../lia/lia-landlord-history';
import { detectMultipleClaims } from '../lia/lia-multi-claim';
import { parseIntakeState } from '../lia/lia-intake.service';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly aiPhoto: AiPhotoService,
    private readonly liaOrchestrator: LiaOrchestratorService,
    private readonly liaConversation: LiaConversationService,
    private readonly caseRef: CaseReferenceService,
    private readonly occupancy: TenantOccupancyService,
  ) {}

  /**
   * Création d'un ticket (locataire) — tenantId = id TenantProfile, pas User.
   *
   * Sprint F (Lia) : accueil immédiat + fil de messages ; analyse IA en arrière-plan
   * (le locataire peut fermer l'app, push à la fin via AiRoutingService).
   */
  async createTicket(tenantUserId: number, dto: CreateTicketDto) {
    const tenantProfile = await this.prisma.tenantProfile.findUnique({
      where: { userId: tenantUserId },
    });

    if (!tenantProfile) {
      throw new BadRequestException('Profil locataire introuvable');
    }

    const housing = await this.prisma.housing.findUnique({
      where: { id: dto.housingId },
      include: {
        landlord: { include: { user: true } },
      },
    });

    if (!housing) throw new NotFoundException('Logement introuvable');

    if (tenantProfile.housingId == null) {
      throw new BadRequestException(
        'Aucun logement actif : contactez votre bailleur.',
      );
    }
    if (tenantProfile.housingId !== dto.housingId) {
      throw new ForbiddenException(
        'Vous ne pouvez ouvrir un ticket que pour votre logement actuel',
      );
    }

    const claims = detectMultipleClaims(dto.title, dto.description);
    if (claims.length > 1 && !dto.claimCategory?.trim()) {
      throw new BadRequestException({
        code: 'MULTIPLE_CLAIMS',
        message:
          'Plusieurs problèmes distincts détectés. Créez une demande séparée pour chaque sujet.',
        claims,
      });
    }

    const ticket = await this.prisma.ticket.create({
      data: {
        title: dto.title,
        description: dto.description,
        tenantId: tenantProfile.id,
        housingId: dto.housingId,
        landlordProfileId: housing.landlordId,
        status: 'NEW',
        responsibility: 'PENDING',
      },
    });

    await this.caseRef.ensureTenantDossierNumber(tenantProfile.id);
    await this.caseRef.assignCaseNumber(ticket.id);

    setImmediate(() => {
      void this.occupancy
        .recordMoveIn(tenantProfile.id, dto.housingId)
        .catch(() => undefined);
    });

    const messages = await this.liaOrchestrator.startTicketConversation(
      ticket.id,
      tenantUserId,
    );

    return {
      ...(await this.getTicketById(ticket.id)),
      messages,
    };
  }

  async getTicketMessages(ticketId: number, userId: number, role: string) {
    return this.liaConversation.listMessages(ticketId, userId, role);
  }

  async postTenantMessage(ticketId: number, tenantUserId: number, content: string) {
    return this.liaOrchestrator.onTenantMessage(ticketId, tenantUserId, content);
  }

  async getTicketById(ticketId: number) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        tenant: { include: { user: { select: { email: true, phone: true } } } },
        housing: true,
      },
    });

    if (!ticket) throw new NotFoundException('Ticket introuvable');

    const artisan = await this.prisma.artisanRequest.findUnique({
      where: { ticketId },
      select: { createdAt: true },
    });
    return this.enrichTicketLandlordFields(ticket, artisan);
  }

  /** Infos lecture seule pour recherche dossier (pas d’envoi planning technicien). */
  private enrichTicketLandlordFields<
    T extends {
      id: number;
      title: string;
      responsibility: string | null;
      aiLastDecision: unknown;
      updatedAt: Date;
    },
  >(ticket: T, artisan: { createdAt: Date } | null) {
    const landlordInfoEvents = buildLandlordInfoEvents({
      title: ticket.title,
      responsibility: ticket.responsibility,
      aiLastDecision: ticket.aiLastDecision,
      updatedAt: ticket.updatedAt,
      hasArtisanRequest: artisan != null,
      artisanRequestedAt: artisan?.createdAt ?? null,
    });
    return { ...ticket, landlordInfoEvents };
  }

  /**
   * Recherche par numéro d'affaire — identité locataire + historique des demandes.
   */
  async lookupByCaseNumber(caseNumberRaw: string, userId: number, role: string) {
    const caseNumber = this.caseRef.normalizeRef(caseNumberRaw);
    const ticket = await this.prisma.ticket.findUnique({
      where: { caseNumber },
      include: {
        tenant: {
          include: {
            user: { select: { id: true, email: true, phone: true } },
          },
        },
        housing: { include: { landlord: true } },
      },
    });
    if (!ticket) {
      throw new NotFoundException(`Aucune affaire pour le numéro ${caseNumber}`);
    }

    await this.assertCanViewTenantDossier(
      userId,
      role,
      ticket.tenantId,
      ticket.housing.landlordId,
      ticket.tenant.userId,
    );

    return this.buildDossierPayload(ticket.tenantId, ticket.id);
  }

  /**
   * Recherche par numéro de dossier locataire (toutes les affaires du locataire).
   */
  async lookupByDossierNumber(
    dossierNumberRaw: string,
    userId: number,
    role: string,
  ) {
    const dossierNumber = this.caseRef.normalizeRef(dossierNumberRaw);
    const tenant = await this.prisma.tenantProfile.findUnique({
      where: { dossierNumber },
      include: {
        housing: true,
        user: { select: { id: true, email: true, phone: true } },
      },
    });
    if (!tenant) {
      throw new NotFoundException(
        `Aucun dossier pour le numéro ${dossierNumber}`,
      );
    }

    const landlordId = tenant.housing?.landlordId;
    await this.assertCanViewTenantDossier(
      userId,
      role,
      tenant.id,
      landlordId,
      tenant.userId,
    );

    return this.buildDossierPayload(tenant.id);
  }

  private async assertCanViewTenantDossier(
    userId: number,
    role: string,
    tenantProfileId: number,
    landlordProfileId: number | null | undefined,
    tenantUserId: number,
  ) {
    if (role === 'ADMIN') return;

    if (role === 'LOCATAIRE') {
      const tp = await this.prisma.tenantProfile.findUnique({
        where: { userId },
      });
      if (!tp || tp.id !== tenantProfileId) {
        throw new ForbiddenException('Accès refusé à ce dossier');
      }
      return;
    }

    if (role === 'BAILLEUR' || role === 'AGENT') {
      const lp = await this.prisma.landlordProfile.findUnique({
        where: { userId },
      });
      if (!lp || landlordProfileId !== lp.id) {
        throw new ForbiddenException('Ce dossier n’appartient pas à votre organisme');
      }
      return;
    }

    throw new ForbiddenException('Rôle non autorisé');
  }

  private async buildDossierPayload(tenantProfileId: number, focusTicketId?: number) {
    const tenant = await this.prisma.tenantProfile.findUnique({
      where: { id: tenantProfileId },
      include: {
        user: { select: { id: true, email: true, phone: true } },
        housing: true,
      },
    });
    if (!tenant) throw new NotFoundException('Locataire introuvable');

    const occupancyHistory = await this.occupancy.getOccupancyHistory(
      tenantProfileId,
    );
    const currentHousingId = tenant.housingId;

    const ticketRows = await this.prisma.ticket.findMany({
      where: { tenantId: tenantProfileId },
      orderBy: { createdAt: 'desc' },
      include: {
        housing: {
          select: {
            id: true,
            address: true,
            city: true,
            postalCode: true,
            residenceUnitNumber: true,
          },
        },
      },
    });

    const artisanRows = await this.prisma.artisanRequest.findMany({
      where: { ticketId: { in: ticketRows.map((t) => t.id) } },
      select: { ticketId: true, createdAt: true },
    });
    const artisanByTicket = new Map(
      artisanRows.map((a) => [a.ticketId, a.createdAt]),
    );

    const ticketHistory = ticketRows.map((t) => {
      const artisanAt = artisanByTicket.get(t.id);
      const artisan = artisanAt ? { createdAt: artisanAt } : null;
      return {
        ...this.enrichTicketLandlordFields(t, artisan),
        housingLabel:
          currentHousingId != null && t.housingId !== currentHousingId
            ? `Ancien logement — ${t.housing?.address ?? ''}`
            : null,
      };
    });

    const focusTicket = focusTicketId
      ? ticketHistory.find((t) => t.id === focusTicketId)
      : ticketHistory[0];

    return {
      dossierNumber: tenant.dossierNumber,
      tenant: {
        id: tenant.id,
        firstName: tenant.firstName,
        lastName: tenant.lastName,
        dossierNumber: tenant.dossierNumber,
        email: tenant.user.email,
        phone: tenant.user.phone,
        housing: tenant.housing
          ? {
              id: tenant.housing.id,
              address: tenant.housing.address,
              city: tenant.housing.city,
              postalCode: tenant.housing.postalCode,
              residenceUnitNumber: tenant.housing.residenceUnitNumber,
            }
          : null,
      },
      occupancyHistory: occupancyHistory.map((row) => ({
        id: row.id,
        housingId: row.housingId,
        address: row.housing.address,
        city: row.housing.city,
        postalCode: row.housing.postalCode,
        residenceUnitNumber: row.housing.residenceUnitNumber,
        from: row.from,
        to: row.to,
        moveOutReason: row.moveOutReason,
        isCurrent: row.to == null && row.housingId === currentHousingId,
        endedLabel:
          row.to != null
            ? `Fin d'occupation : ${row.to.toLocaleDateString('fr-FR')}${
                row.moveOutReason === 'ETAT_DES_LIEUX_SORTIE'
                  ? ' (état des lieux de sortie)'
                  : ''
              }`
            : null,
      })),
      focusTicket,
      ticketHistory,
      totalTickets: ticketHistory.length,
    };
  }

  async getMyTickets(userId: number, role: string) {
    if (role === 'LOCATAIRE') {
      const tp = await this.prisma.tenantProfile.findUnique({
        where: { userId },
      });
      if (!tp) return [];

      return this.prisma.ticket.findMany({
        where: { tenantId: tp.id },
        orderBy: { createdAt: 'desc' },
        include: { housing: true },
      });
    }

    if (role === 'BAILLEUR') {
      const lp = await this.prisma.landlordProfile.findUnique({
        where: { userId },
      });
      if (!lp) return [];

      return this.prisma.ticket.findMany({
        where: { housing: { landlordId: lp.id } },
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: true,
          housing: true,
        },
      });
    }

    return this.prisma.ticket.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: true,
        housing: true,
      },
    });
  }

  async updateTicket(
    userId: number,
    role: string,
    ticketId: number,
    dto: UpdateTicketDto,
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { housing: true },
    });

    if (!ticket) throw new NotFoundException('Ticket introuvable');

    if (role === 'BAILLEUR') {
      const lp = await this.prisma.landlordProfile.findUnique({
        where: { userId },
      });
      if (!lp || ticket.housing.landlordId !== lp.id) {
        throw new ForbiddenException('Vous ne pouvez pas modifier ce ticket');
      }
    } else if (role === 'LOCATAIRE') {
      const tp = await this.prisma.tenantProfile.findUnique({
        where: { userId },
      });
      if (!tp || ticket.tenantId !== tp.id) {
        throw new ForbiddenException('Vous ne pouvez pas modifier ce ticket');
      }
    }

    return this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        title: dto.title ?? ticket.title,
        description: dto.description ?? ticket.description,
        status: (dto.status ?? ticket.status) as TicketStatus,
      },
    });
  }

  async analyzePhoto(photoUrl: string) {
    const analysis = await this.aiPhoto.analyzePhoto(photoUrl);

    return {
      success: true,
      analysis,
    };
  }

  /**
   * GET /tickets/me/routed — vue ciblée pour le locataire : ne renvoie que
   * les tickets dont l'IA a déjà rendu un verdict (utile pour l'UI mobile
   * qui affiche la fiche "diagnostic IA terminé").
   */
  async getMyRoutedTickets(tenantUserId: number) {
    const tp = await this.prisma.tenantProfile.findUnique({
      where: { userId: tenantUserId },
    });
    if (!tp) return [];

    return this.prisma.ticket.findMany({
      where: {
        tenantId: tp.id,
        responsibility: { not: 'PENDING' },
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        responsibility: true,
        nonRecevableReason: true,
        aiCategory: true,
        aiSeverity: true,
        aiConfidence: true,
        aiSuggestedArtisanType: true,
        aiAttempts: true,
        aiLastDecision: true,
        escalatedAt: true,
        escalationReason: true,
        createdAt: true,
        updatedAt: true,
        housing: { select: { id: true, address: true } },
      },
    });
  }
}
