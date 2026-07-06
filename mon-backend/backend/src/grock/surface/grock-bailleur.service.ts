import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GrockService, type GrockTurnResult } from '../grock.service';
import type { ConverseGrockLandlordDto } from './dto/grock-bailleur.dto';

/**
 * Surface bailleur — branche le même moteur Grock avec interlocuteur `landlord`.
 */
@Injectable()
export class GrockBailleurService {
  constructor(
    private readonly grock: GrockService,
    private readonly prisma: PrismaService,
  ) {}

  async converseOnTicket(
    userId: number,
    dto: ConverseGrockLandlordDto,
  ): Promise<GrockTurnResult> {
    const msg = dto.message?.trim();
    if (!msg) throw new BadRequestException('Message requis.');

    const lp = await this.prisma.landlordProfile.findFirst({
      where: { userId },
    });
    if (!lp) throw new ForbiddenException('Profil bailleur introuvable.');

    const ticket = await this.prisma.ticket.findFirst({
      where: {
        id: dto.ticketId,
        OR: [
          { landlordProfileId: lp.id },
          { housing: { landlordId: lp.id } },
        ],
      },
      include: {
        housing: { select: { address: true, city: true, postalCode: true } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket introuvable ou hors périmètre.');

    const landlordContext = [
      `Référence : ${ticket.caseNumber ?? `#${ticket.id}`}`,
      `Logement : ${ticket.housing?.address ?? '—'}, ${ticket.housing?.postalCode ?? ''} ${ticket.housing?.city ?? ''}`.trim(),
      `Statut dossier : ${ticket.status}`,
      `Responsabilité IA : ${ticket.responsibility ?? 'PENDING'}`,
      ticket.aiConfidence != null ? `Confiance IA : ${ticket.aiConfidence}` : null,
      ticket.aiCategory ? `Catégorie IA : ${ticket.aiCategory}` : null,
      ticket.aiSeverity ? `Sévérité IA : ${ticket.aiSeverity}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    return this.grock.runTurn({
      tenantFirstName: '',
      title: ticket.title,
      description: ticket.description,
      ticketHistory: [],
      sessionMessages: dto.sessionMessages ?? [],
      tenantMessage: msg,
      mode: 'tenant_turn',
      interlocutor: 'landlord',
      landlordContext,
      ticketId: ticket.id,
    });
  }
}
