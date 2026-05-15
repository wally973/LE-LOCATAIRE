import type { TicketResponsibility, TicketStatus } from '@prisma/client';

/** Ticket résumé pour le tableau de bord bailleur. */
export interface LandlordDashboardTicketRow {
  id: number;
  title: string;
  status: TicketStatus;
  responsibility: TicketResponsibility;
  aiCategory: string | null;
  aiConfidence: number | null;
  escalatedAt: Date | null;
  escalationReason: string | null;
  aiAttempts: number;
  createdAt: Date;
  housing: { id: number; address: string };
  tenant: { id: number; firstName: string; lastName: string };
}

export interface LandlordDashboardResponse {
  profile: {
    landlordProfileId: number;
    name: string;
  };
  stats: {
    housingCount: number;
    tenantCount: number;
    openTickets: number;
    invoices: {
      total: number;
      paid: number;
      pending: number;
      unpaid: number;
    };
  };
  ticketsByResponsibility: Record<TicketResponsibility, number>;
  ticketsByStatus: Partial<Record<TicketStatus, number>>;
  escalations: {
    active: number;
    awaitingAi: number;
    recent: LandlordDashboardTicketRow[];
  };
  ai: {
    routedCount: number;
    avgConfidence: number | null;
    pendingAnalysis: number;
    nonRecevableCount: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
  };
  recentTickets: LandlordDashboardTicketRow[];
}
