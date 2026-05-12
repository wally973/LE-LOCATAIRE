import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AiQualityService } from '../ai/ai-quality.service';

@Injectable()
export class PlanningService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private aiQuality: AiQualityService,
  ) {}

  // ARTISAN : signature numérique + rapport IA + facture
  async signIntervention(artisanId: number, slotId: number, signatureUrl: string) {
    const slot = await this.prisma.planningSlot.findUnique({
      where: { id: slotId },
      include: {
        ticket: {
          include: {
            documents: true,
            housing: { include: { landlord: { include: { user: true } } } },
            tenant: true,
          },
        },
        artisan: true,
      },
    });

    if (!slot) throw new NotFoundException('Créneau introuvable');
    if (slot.artisanId !== artisanId) {
      throw new ForbiddenException('Vous ne pouvez pas signer cette intervention');
    }

    // 1) Mise à jour du créneau
    await this.prisma.planningSlot.update({
      where: { id: slotId },
      data: {
        signatureUrl,
        signedAt: new Date(),
        status: 'DONE',
      },
    });

    // 2) Génération du rapport IA
    const report = await this.aiQuality.generateInterventionReport(slotId);

    // 3) Sauvegarde du rapport dans la base
    await this.prisma.document.create({
      data: {
        type: 'RAPPORT_INTERVENTION',
        ticketId: slot.ticketId!,
        content: JSON.stringify(report),
      },
    });

    // 4) Notification bailleur
    await this.notifications.createNotification({
      userId: slot.ticket!.housing.landlord.userId,
      title: 'Intervention terminée',
      message: `Un rapport d’intervention IA est disponible pour le ticket #${slot.ticketId}.`,
      type: 'INFO',
    });

    return {
      success: true,
      message: 'Intervention signée et rapport IA généré.',
      report,
    };
  }

  // Récupérer un rapport IA
  async getInterventionReport(slotId: number) {
    const doc = await this.prisma.document.findFirst({
      where: {
        ticket: {
          planningSlots: {
            some: { id: slotId },
          },
        },
        type: 'RAPPORT_INTERVENTION',
      },
    });

    if (!doc) throw new NotFoundException('Aucun rapport IA trouvé');

    return JSON.parse(doc.content || '{}');
  }

  // Récupérer les créneaux d’un artisan
  async getArtisanSlots(artisanId: number) {
    return this.prisma.planningSlot.findMany({
      where: { artisanId },
      include: { ticket: true },
      orderBy: { startDate: 'asc' },
    });
  }

  // Récupérer les créneaux d’un ticket
  async getTicketSlots(ticketId: number) {
    return this.prisma.planningSlot.findMany({
      where: { ticketId },
      orderBy: { startDate: 'asc' },
    });
  }
}
