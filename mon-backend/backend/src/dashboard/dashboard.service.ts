import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getGlobalStats() {
    const [
      totalUsers,
      tenants,
      landlords,
      artisans,
      tickets,
      openTickets,
      resolvedTickets,
      housingUnits,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: 'LOCATAIRE' } }),
      this.prisma.user.count({ where: { role: 'BAILLEUR' } }),
      this.prisma.user.count({ where: { role: 'PRESTATAIRE' } }),
      this.prisma.ticket.count(),
      this.prisma.ticket.count({ where: { status: 'OPEN' } }),
      this.prisma.ticket.count({ where: { status: 'RESOLVED' } }),
      this.prisma.housing.count(),
    ]);

    return {
      users: { total: totalUsers, tenants, landlords, artisans },
      tickets: { total: tickets, open: openTickets, resolved: resolvedTickets },
      housing: { total: housingUnits },
    };
  }

  async getTicketStats() {
    const tickets = await this.prisma.ticket.findMany({
      select: { status: true, aiConfidence: true },
    });

    const total = tickets.length;
    const resolved = tickets.filter((t) => t.status === 'RESOLVED').length;

    const avgConfidence =
      total > 0
        ? tickets.reduce((sum, t) => sum + (t.aiConfidence ?? 0), 0) / total
        : 0;

    return {
      total,
      resolved,
      resolutionRate: total > 0 ? resolved / total : 0,
      avgConfidence,
    };
  }

  async getArtisanStats() {
    const artisans = await this.prisma.user.count({
      where: { role: 'PRESTATAIRE' },
    });

    const interventions = await this.prisma.planningSlot.count();
    const completed = await this.prisma.planningSlot.count({
      where: { status: 'COMPLETED' },
    });

    return {
      artisans,
      interventions,
      completed,
      completionRate: interventions > 0 ? completed / interventions : 0,
    };
  }

  async getFullDashboard() {
    const [global, tickets, artisans] = await Promise.all([
      this.getGlobalStats(),
      this.getTicketStats(),
      this.getArtisanStats(),
    ]);

    return { global, tickets, artisans };
  }
}
