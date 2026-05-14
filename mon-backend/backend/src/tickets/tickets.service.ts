import {
  Injectable,
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
import { AiRoutingService } from '../ai-routing/ai-routing.service';

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly aiPhoto: AiPhotoService,
    private readonly aiRouting: AiRoutingService,
  ) {}

  /**
   * Création d'un ticket (locataire) — tenantId = id TenantProfile, pas User.
   *
   * Sprint 3 : le ticket est créé en status=NEW + responsibility=PENDING puis
   * le pipeline IA est lancé immédiatement. La décision (routage, message au
   * locataire, notifications) est gérée par AiRoutingService.
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

    // Pipeline IA : routage automatique + side effects (notifications, etc.)
    await this.aiRouting.analyzeTicket(ticket.id, { force: true });

    return this.getTicketById(ticket.id);
  }

  async getTicketById(ticketId: number) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        tenant: true,
        housing: true,
      },
    });

    if (!ticket) throw new NotFoundException('Ticket introuvable');

    return ticket;
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
