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
import { AiTicketService } from '../ai/ai-ticket.service';
import { AiDispatchService } from '../ai/ai-dispatch.service';
import { AiPhotoService } from '../ai/ai-photo.service';

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly aiTicket: AiTicketService,
    private readonly aiDispatch: AiDispatchService,
    private readonly aiPhoto: AiPhotoService,
  ) {}

  /**
   * Création d’un ticket (locataire) — tenantId = id TenantProfile, pas User.
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

    const diagnostic = await this.aiTicket.analyze(dto.description);

    if (!diagnostic) {
      throw new BadRequestException('Impossible d\'analyser la description');
    }

    const ticket = await this.prisma.ticket.create({
      data: {
        title: dto.title,
        description: dto.description,
        tenantId: tenantProfile.id,
        housingId: dto.housingId,
        status: 'OPEN',
        aiCategory: diagnostic.category,
        aiSeverity: diagnostic.severity,
        aiConfidence: diagnostic.confidence,
      },
    });

    await this.notifications.createNotification({
      userId: housing.landlord.userId,
      title: 'Nouveau ticket créé',
      message: `Un nouveau ticket a été créé pour le logement ${housing.address}.`,
      type: 'INFO',
    });

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
}
