import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiDispatchService {
  constructor(private readonly prisma: PrismaService) {}

  async chooseBestArtisanForTicket(ticketId: number) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket introuvable');
    }

    // Récupérer les artisans = Users avec rôle ARTISAN
    const artisans = await this.prisma.user.findMany({
      where: { role: 'PRESTATAIRE' },
    });

    if (artisans.length === 0) {
      return null;
    }

    const category = ticket.aiCategory?.toLowerCase() || '';

    const scored = artisans.map((artisan) => {
      let score = 0.5;

      if (category.includes('plumb')) score += 0.2;
      if (category.includes('electric')) score += 0.2;
      if (category.includes('humidity')) score += 0.1;
      if (category.includes('lock')) score += 0.1;

      return {
        artisanId: artisan.id,
        score,
        distanceKm: null,
      };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored[0];
  }
}
