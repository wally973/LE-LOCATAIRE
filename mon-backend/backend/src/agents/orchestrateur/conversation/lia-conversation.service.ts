import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TicketMessageRole } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { BailleurScopeService } from '../../../auth/scope/bailleur-scope.service';
import type { LiaMessageUiStatus } from './lia-message-ui-status';

@Injectable()
export class LiaConversationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: BailleurScopeService,
  ) {}

  async listMessages(ticketId: number, userId: number, role: string) {
    await this.assertCanAccessTicket(ticketId, userId, role);
    const messages = await this.prisma.ticketMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
    });
    return messages.map((message) => {
      if (
        (message.role as unknown) === 'assistant' &&
        (message as unknown as { note_interne?: string }).note_interne
      ) {
        delete (message as unknown as { note_interne?: string }).note_interne;
      }
      if (!message.metadata || typeof message.metadata !== 'object') return message;
      const metadata = JSON.parse(JSON.stringify(message.metadata)) as Record<string, unknown>;
      delete metadata.note_interne;
      delete metadata.noteInterne;
      return { ...message, metadata };
    });
  }

  async appendMessage(
    ticketId: number,
    role: TicketMessageRole,
    content: string,
    locale = 'fr-FR',
    metadata?: { uiStatus?: LiaMessageUiStatus },
  ) {
    const meta: Prisma.InputJsonValue | undefined = metadata?.uiStatus
      ? (JSON.parse(
          JSON.stringify({ uiStatus: metadata.uiStatus }),
        ) as Prisma.InputJsonValue)
      : undefined;
    return this.prisma.ticketMessage.create({
      data: { ticketId, role, content, locale, metadata: meta },
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

    if (jwtRole === 'BAILLEUR' || jwtRole === 'AGENT') {
      const scope = await this.scopeService.resolve({ id: userId, role: jwtRole });
      if (!scope.landlordProfileId) {
        throw new ForbiddenException('Profil bailleur introuvable');
      }
      const landlordId = ticket.landlordProfileId ?? ticket.housing.landlordId;
      if (landlordId !== scope.landlordProfileId) {
        throw new ForbiddenException('Accès refusé');
      }
      if (jwtRole === 'AGENT' && scope.agenceId != null) {
        if (ticket.housing.agenceId !== scope.agenceId) {
          throw new ForbiddenException('Ticket hors de votre secteur');
        }
      }
      return ticket;
    }

    throw new ForbiddenException('Accès refusé');
  }
}
