import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiQualityService {
  constructor(private readonly prisma: PrismaService) {}

  async analyzeBeforeAfter(beforeUrl: string, afterUrl: string) {
    return {
      qualityScore: 0.9,
      isResolved: true,
      comments: 'La réparation semble correcte, aucune anomalie visible.',
    };
  }

  async generateInterventionReport(slotId: number) {
    const slot = await this.prisma.planningSlot.findUnique({
      where: { id: slotId },
      include: {
        ticket: {
          include: {
            housing: true,
            tenant: true,
            documents: true, // les photos sont dans Document
          },
        },
        artisan: true, // User
      },
    });

    if (!slot || !slot.ticket) {
      return null;
    }

    // Les photos sont dans Document (type = RAPPORT_INTERVENTION ?)
    const photos = slot.ticket.documents ?? [];
    const beforePhoto = photos[0]?.url ?? null;
    const afterPhoto = photos[1]?.url ?? null;

    const quality =
      beforePhoto && afterPhoto
        ? await this.analyzeBeforeAfter(beforePhoto, afterPhoto)
        : {
            qualityScore: 0.7,
            isResolved: true,
            comments:
              'Pas assez de données visuelles, mais l’intervention est marquée comme terminée.',
          };

    return {
      slotId,
      ticketId: slot.ticket.id,
      artisan: slot.artisan.email ?? 'Artisan inconnu',
      housing: slot.ticket.housing.address,
      tenant: `${slot.ticket.tenant.firstName} ${slot.ticket.tenant.lastName}`,
      startedAt: slot.startDate,
      endedAt: slot.endDate,
      quality,
    };
  }
}
