import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DiagnosticContextService } from '../agents/shared/diagnostic-context.service';
import {
  INSURANCE_REFOULEMENT_EU_NOTE,
  isSavonneuseR1RefoulementSensors,
} from '../agents/shared/refoulement-eu-context';
import type { DiagnosticSensors } from '../agents/shared/lia-diagnostic-state.types';

export interface InsuranceClaimAssessment {
  ticketId: number;
  sensors: DiagnosticSensors;
  refoulementEuSuspected: boolean;
  /** Indication métier pour le gestionnaire sinistre. */
  responsibilityHint?: 'BAILLEUR_COLLECTIF' | 'A_ANALYSER';
  notes: string[];
}

@Injectable()
export class AiInsuranceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly diagnosticContext: DiagnosticContextService,
  ) {}

  async checkTenantInsurance(
    tenantId: number,
    opts?: { ticketId?: number },
  ) {
    const tenant = await this.prisma.tenantProfile.findUnique({
      where: { id: tenantId },
      include: {
        housing: true,
        user: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Locataire introuvable');
    }

    const documents = await this.prisma.document.findMany({
      where: {
        tenantId,
        type: 'ASSURANCE_HABITATION',
      },
      orderBy: { createdAt: 'desc' },
    });

    const hasInsurance = documents.length > 0;

    const claimAssessment = opts?.ticketId
      ? await this.assessSinistreForTicket(opts.ticketId)
      : null;

    return {
      tenant: {
        id: tenant.id,
        name: `${tenant.firstName} ${tenant.lastName}`,
      },
      housing: tenant.housing
        ? {
            id: tenant.housing.id,
            address: tenant.housing.address,
            city: tenant.housing.city,
          }
        : null,
      insurance: {
        hasInsurance,
        lastDocument: hasInsurance ? documents[0] : null,
      },
      claimAssessment,
    };
  }

  /**
   * Qualification sinistre à partir des capteurs diagnostic (Phase 2 — Savoir-Voir).
   */
  async assessSinistreForTicket(
    ticketId: number,
  ): Promise<InsuranceClaimAssessment> {
    const ctx = await this.diagnosticContext.fromTicket(ticketId);
    const refoulement = isSavonneuseR1RefoulementSensors(ctx.sensors);
    const notes: string[] = [];

    if (refoulement) {
      notes.push(INSURANCE_REFOULEMENT_EU_NOTE);
      if (ctx.sensors.timing_pattern?.trim()) {
        notes.push(
          `Créneau horaire signalé : ${ctx.sensors.timing_pattern} — cohérent avec un pic de charge sur le réseau EU de l’immeuble.`,
        );
      }
      if (ctx.sensors.weather_context?.trim()) {
        notes.push(`Contexte météo : ${ctx.sensors.weather_context}.`);
      }
    }

    return {
      ticketId: ctx.ticketId,
      sensors: ctx.sensors,
      refoulementEuSuspected: refoulement,
      responsibilityHint: refoulement ? 'BAILLEUR_COLLECTIF' : 'A_ANALYSER',
      notes,
    };
  }
}
