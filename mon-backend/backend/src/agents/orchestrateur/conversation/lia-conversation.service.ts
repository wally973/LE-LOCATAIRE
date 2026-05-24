import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TicketMessageRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LiaConversationService {
  constructor(private readonly prisma: PrismaService) {}

  async listMessages(ticketId: number, userId: number, role: string) {
    await this.assertCanAccessTicket(ticketId, userId, role);
    return this.prisma.ticketMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async appendMessage(
    ticketId: number,
    role: TicketMessageRole,
    content: string,
    locale = 'fr-FR',
  ) {
    return this.prisma.ticketMessage.create({
      data: { ticketId, role, content, locale },
    });
  }

  async assertCanAccessTicket(ticketId: number, userId: number, jwtRole: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        tenant: true,
        housing: { include: { landlord: true } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket introuvable');

    if (jwtRole === 'ADMIN') return ticket;

    if (jwtRole === 'LOCATAIRE') {
      if (ticket.tenant.userId !== userId) {
        throw new ForbiddenException('Accès refusé');
      }
      return ticket;
    }

    if (jwtRole === 'BAILLEUR') {
      const lp = await this.prisma.landlordProfile.findUnique({
        where: { userId },
      });
      if (!lp || ticket.housing.landlordId !== lp.id) {
        throw new ForbiddenException('Accès refusé');
      }
      return ticket;
    }

    throw new ForbiddenException('Accès refusé');
  }
}
