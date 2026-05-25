import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DiagnosticContextService } from '../agents/shared/diagnostic-context.service';
import { resolveAiCategoryFromContext } from '../agents/shared/diagnostic-ticket-insights';

@Injectable()
export class AiDispatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly diagnosticContext: DiagnosticContextService,
  ) {}

  async chooseBestArtisanForTicket(ticketId: number) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket introuvable');
    }

    const ctx = await this.diagnosticContext.fromTicket(ticketId);
    const category = (
      ticket.aiCategory ?? resolveAiCategoryFromContext(ctx)
    ).toLowerCase();

    const artisans = await this.prisma.user.findMany({
      where: { role: 'PRESTATAIRE' },
    });

    if (artisans.length === 0) {
      return null;
    }

    const scored = artisans.map((artisan) => {
      let score = 0.5;

      if (category.includes('plumb') || ctx.sensors.water_aspect) {
        score += 0.25;
      }
      if (category.includes('electric') || ctx.sensors.electric_scope) {
        score += 0.25;
      }
      if (category.includes('humid') || ctx.sensors.humidity_link) {
        score += 0.15;
      }
      if (category.includes('lock') || category.includes('serrur')) {
        score += 0.15;
      }
      if (category.includes('heat') || ctx.sensors.weather_context) {
        score += 0.1;
      }
      if (ctx.savoirVoirPhase === 'CONCLUSION') {
        score += 0.05;
      }

      return {
        artisanId: artisan.id,
        score: Math.min(score, 1),
        distanceKm: null,
        diagnosticPhase: ctx.savoirVoirPhase,
      };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored[0];
  }
}
