import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ArtisanRequestStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { BailleurScope } from '../auth/scope/bailleur-scope.types';
import { CreateArtisanRequestDto } from './dto/create-artisan-request.dto';
import { UpdateArtisanRequestDto } from './dto/update-artisan-request.dto';

/**
 * Service métier des demandes d'artisan.
 *
 * Une demande est créée par le locataire après une décision IA "LOCATAIRE"
 * (Sprint 3) lorsque les tutoriels ne suffisent pas. Elle arrive sur ton
 * backoffice admin (owner) ; le bailleur en a une visibilité lecture seule.
 *
 * Garde-fous :
 *  - le ticket doit être en `responsibility=LOCATAIRE` et non clôturé
 *  - une seule ArtisanRequest par ticket (contrainte @unique)
 *  - le bailleur n'écrit jamais (lecture seule) — uniquement l'admin
 */
@Injectable()
export class ArtisanRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Création par le locataire — déclenchée par
   * POST /tickets/:id/artisan-request.
   */
  async createFromTicket(
    tenantUserId: number,
    ticketId: number,
    dto: CreateArtisanRequestDto,
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        tenant: { include: { user: true } },
        housing: { include: { landlord: { include: { user: true } } } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket introuvable');
    if (ticket.tenant.userId !== tenantUserId) {
      throw new ForbiddenException('Ce ticket ne vous appartient pas.');
    }
    if (ticket.responsibility !== 'LOCATAIRE') {
      throw new BadRequestException(
        'Une demande d’artisan ne peut être ouverte que pour un ticket à votre charge.',
      );
    }
    if (['RESOLVED', 'AUTO_CLOSED', 'CANCELLED'].includes(ticket.status)) {
      throw new BadRequestException('Ce ticket est déjà clôturé.');
    }

    const existing = await this.prisma.artisanRequest.findUnique({
      where: { ticketId },
    });
    if (existing) {
      throw new ConflictException(
        'Une demande d’artisan a déjà été ouverte pour ce ticket.',
      );
    }

    const request = await this.prisma.artisanRequest.create({
      data: {
        ticketId,
        tenantId: ticket.tenantId,
        landlordProfileId: ticket.housing.landlordId,
        category: ticket.aiCategory ?? 'OTHER',
        severity: ticket.aiSeverity ?? 'LOW',
        status: 'NEW',
        tenantReason: dto.reason ?? null,
      },
    });

    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status: 'IN_PROGRESS' },
    });

    await this.fireCreationNotifications(ticket);

    return request;
  }

  /**
   * Listing admin — paginable et filtrable.
   * Aucun filtre multi-tenant : l'admin voit toutes les demandes.
   */
  async listForAdmin(filters: {
    status?: ArtisanRequestStatus;
    landlordProfileId?: number;
    category?: string;
  }) {
    const where: Prisma.ArtisanRequestWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.landlordProfileId)
      where.landlordProfileId = filters.landlordProfileId;
    if (filters.category) where.category = filters.category;

    return this.prisma.artisanRequest.findMany({
      where,
      orderBy: [{ status: 'asc' }, { requestedAt: 'desc' }],
      include: {
        ticket: {
          select: {
            id: true,
            title: true,
            description: true,
            aiSeverity: true,
            aiCategory: true,
            status: true,
          },
        },
        tenant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            user: { select: { phone: true, email: true } },
          },
        },
        landlord: {
          select: { id: true, name: true },
        },
      },
    });
  }

  /**
   * Détail admin — utilisé pour la fiche complète.
   */
  async findOneForAdmin(id: number) {
    const request = await this.prisma.artisanRequest.findUnique({
      where: { id },
      include: {
        ticket: {
          include: {
            housing: true,
            documents: true,
          },
        },
        tenant: {
          include: { user: true },
        },
        landlord: true,
      },
    });
    if (!request) throw new NotFoundException('Demande d’artisan introuvable');
    return request;
  }

  /**
   * Mise à jour admin — statut, notes, créneaux, complétion.
   *
   * Effets de bord :
   *  - TRIAGED       → notif locataire ("Votre demande est prise en compte")
   *  - IN_PROGRESS   → notif locataire ("Un créneau vous a été proposé")
   *  - DONE          → notif locataire + bailleur ("Intervention terminée")
   *  - CANCELLED     → notif locataire ("Demande annulée")
   */
  async updateForAdmin(id: number, dto: UpdateArtisanRequestDto) {
    const request = await this.findOneForAdmin(id);

    const nextStatus = dto.status ?? request.status;
    const wasStatusChange = nextStatus !== request.status;

    // Si completedAt est fourni sans statut explicite → on bascule DONE.
    const finalStatus: ArtisanRequestStatus =
      dto.completedAt && !dto.status ? 'DONE' : nextStatus;

    const updated = await this.prisma.artisanRequest.update({
      where: { id },
      data: {
        status: finalStatus,
        adminNotes: dto.adminNotes ?? request.adminNotes,
        slotProposedAt: dto.slotProposedAt
          ? new Date(dto.slotProposedAt)
          : request.slotProposedAt,
        slotConfirmedAt: dto.slotConfirmedAt
          ? new Date(dto.slotConfirmedAt)
          : request.slotConfirmedAt,
        completedAt: dto.completedAt
          ? new Date(dto.completedAt)
          : request.completedAt,
      },
    });

    if (wasStatusChange || finalStatus === 'DONE') {
      await this.fireStatusNotifications(request, updated.status);
    }

    return updated;
  }

  /**
   * Listing bailleur (lecture seule, scope multi-tenant).
   * Sprint 4 : on choisit la visibilité full (P3 = full).
   */
  async listForLandlord(scope: BailleurScope) {
    if (!scope.landlordProfileId && !scope.isAdmin) {
      throw new ForbiddenException(
        'Aucun bailleur associé à votre compte. Contactez votre administrateur.',
      );
    }

    const where: Prisma.ArtisanRequestWhereInput = scope.isAdmin
      ? {}
      : { landlordProfileId: scope.landlordProfileId };

    return this.prisma.artisanRequest.findMany({
      where,
      orderBy: [{ status: 'asc' }, { requestedAt: 'desc' }],
      include: {
        ticket: {
          select: {
            id: true,
            title: true,
            aiSeverity: true,
            aiCategory: true,
            status: true,
          },
        },
        tenant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  // --------------------------------------------------------------------------
  // Internes — notifications
  // --------------------------------------------------------------------------

  /**
   * Notifications déclenchées à la création d'une demande :
   * - locataire : accusé de réception
   * - admins (tous) : nouvelle demande à traiter
   * - bailleur du logement : visibilité info (P3 = full)
   */
  private async fireCreationNotifications(ticket: {
    id: number;
    title: string;
    tenant: { userId: number; firstName: string; lastName: string };
    housing: { address: string; landlord: { userId: number } };
  }) {
    await this.notifications.createNotification({
      userId: ticket.tenant.userId,
      title: 'Demande d’artisan reçue',
      message:
        'Votre demande a bien été enregistrée. Un devis vous sera proposé prochainement.',
      type: 'INFO',
    });

    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });
    for (const a of admins) {
      await this.notifications.createNotification({
        userId: a.id,
        title: `Nouvelle demande d’artisan — ticket #${ticket.id}`,
        message: `"${ticket.title}" — logement ${ticket.housing.address}. À trier dans le backoffice.`,
        type: 'WARNING',
      });
    }

    await this.notifications.createNotification({
      userId: ticket.housing.landlord.userId,
      title: 'Votre locataire a demandé un artisan',
      message: `${ticket.tenant.firstName} ${ticket.tenant.lastName} a sollicité un artisan pour le ticket #${ticket.id}.`,
      type: 'INFO',
    });
  }

  /**
   * Notifications sur transitions de statut.
   * On lit l'utilisateur cible depuis la requête (déjà fetched par findOneForAdmin).
   */
  private async fireStatusNotifications(
    request: Awaited<ReturnType<ArtisanRequestsService['findOneForAdmin']>>,
    nextStatus: ArtisanRequestStatus,
  ) {
    const tenantUserId = request.tenant.userId;

    switch (nextStatus) {
      case 'TRIAGED':
        await this.notifications.createNotification({
          userId: tenantUserId,
          title: 'Votre demande est prise en compte',
          message:
            'Nous recherchons un artisan disponible. Un créneau vous sera proposé sous peu.',
          type: 'INFO',
        });
        break;
      case 'IN_PROGRESS':
        await this.notifications.createNotification({
          userId: tenantUserId,
          title: 'Un créneau vous a été proposé',
          message: request.slotProposedAt
            ? `Un artisan vous est proposé le ${request.slotProposedAt.toLocaleString('fr-FR')}.`
            : 'Un artisan vous a été proposé. Vérifiez votre application.',
          type: 'INFO',
        });
        break;
      case 'DONE':
        await this.notifications.createNotification({
          userId: tenantUserId,
          title: 'Intervention terminée',
          message:
            'L’intervention a été marquée comme terminée. Merci de confirmer la résolution depuis votre application.',
          type: 'INFO',
        });
        // Visibilité bailleur — P3 = full
        if (request.landlord) {
          const landlordUser = await this.prisma.landlordProfile.findUnique({
            where: { id: request.landlordProfileId },
            select: { userId: true },
          });
          if (landlordUser) {
            await this.notifications.createNotification({
              userId: landlordUser.userId,
              title: 'Intervention artisan terminée',
              message: `Intervention artisan terminée chez ${request.tenant.firstName} ${request.tenant.lastName} (ticket #${request.ticketId}).`,
              type: 'INFO',
            });
          }
        }
        break;
      case 'CANCELLED':
        await this.notifications.createNotification({
          userId: tenantUserId,
          title: 'Demande annulée',
          message:
            'Votre demande d’artisan a été annulée. Vous pouvez en ouvrir une nouvelle si nécessaire.',
          type: 'WARNING',
        });
        break;
      default:
        break;
    }
  }
}
