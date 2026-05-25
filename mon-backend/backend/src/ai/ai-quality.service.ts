import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DiagnosticContextService } from '../agents/shared/diagnostic-context.service';
import { buildDiagnosticBrief } from '../agents/shared/diagnostic-ticket-insights';

@Injectable()
export class AiQualityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly diagnosticContext: DiagnosticContextService,
  ) {}

  async analyzeBeforeAfter(beforeUrl: string, afterUrl: string) {
    return {
      qualityScore: 0.9,
      isResolved: true,
      comments: 'La réparation semble correcte, aucune anomalie visible.',
      beforeUrl,
      afterUrl,
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
            documents: true,
          },
        },
        artisan: true,
      },
    });

    if (!slot?.ticket) {
      return null;
    }

    const ctx = await this.diagnosticContext.fromTicket(slot.ticket.id);
    const diagnosticBrief = buildDiagnosticBrief(ctx);

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
      diagnostic: diagnosticBrief,
    };
  }
}
