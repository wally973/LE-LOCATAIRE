import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Génération des numéros lisibles : dossier locataire + affaire (ticket).
 */
@Injectable()
export class CaseReferenceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Normalise la saisie (casse, espaces). */
  normalizeRef(raw: string): string {
    return raw.trim().toUpperCase().replace(/\s+/g, '');
  }

  formatDossierNumber(tenantProfileId: number): string {
    return `DOS-${String(tenantProfileId).padStart(6, '0')}`;
  }

  formatCaseNumber(ticketId: number, createdAt: Date = new Date()): string {
    const year = createdAt.getFullYear();
    return `AFF-${year}-${String(ticketId).padStart(6, '0')}`;
  }

  /** Attribue un dossier locataire s'il n'existe pas encore. */
  async ensureTenantDossierNumber(tenantProfileId: number): Promise<string> {
    const tp = await this.prisma.tenantProfile.findUnique({
      where: { id: tenantProfileId },
      select: { dossierNumber: true },
    });
    if (tp?.dossierNumber) return tp.dossierNumber;

    const dossierNumber = this.formatDossierNumber(tenantProfileId);
    await this.prisma.tenantProfile.update({
      where: { id: tenantProfileId },
      data: { dossierNumber },
    });
    return dossierNumber;
  }

  async assignCaseNumber(ticketId: number): Promise<string> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, createdAt: true, caseNumber: true },
    });
    if (!ticket) throw new Error('Ticket introuvable');
    if (ticket.caseNumber) return ticket.caseNumber;

    const caseNumber = this.formatCaseNumber(ticket.id, ticket.createdAt);
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { caseNumber },
    });
    return caseNumber;
  }
}
