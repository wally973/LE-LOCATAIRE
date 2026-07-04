import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  mergeAiLastDecision,
  sanitizeIntakeForTicket,
  type IntakeCategory,
  type LiaIntakeState,
} from './lia-intake.service';
import { LiaJarvisHandoffService } from './lia-jarvis-handoff.service';

/** Métadonnées clôture non recevable / charge locataire. */
export interface NonRecevableTicketMeta {
  reason: string;
  category?: IntakeCategory;
  domain?: string;
  conclusion?: string;
  intake?: LiaIntakeState;
  [key: string]: unknown;
}

/** Finalisation ticket après auto-conclusion Grock. */
@Injectable()
export class LiaTicketFinalizerService {
  private readonly logger = new Logger(LiaTicketFinalizerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly handoff: LiaJarvisHandoffService,
  ) {}

  async finalizeTicketForBailleur(params: {
    ticketId: number;
    intake: LiaIntakeState;
    conclusion: string;
    reason?: string;
    visualizationNote?: string;
  }): Promise<void> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: params.ticketId },
      select: { aiLastDecision: true },
    });
    if (!ticket) return;

    const intakeDone: LiaIntakeState = {
      ...params.intake,
      phase: 'DONE',
      answers: {
        ...params.intake.answers,
        jarvis_intake_complete: 'oui',
        jarvis_auto_conclusion: 'bailleur_responsable',
      },
    };

    await this.prisma.ticket.update({
      where: { id: params.ticketId },
      data: {
        responsibility: 'BAILLEUR',
        status: 'OPEN',
        aiLastDecision: mergeAiLastDecision(ticket.aiLastDecision, {
          intake: sanitizeIntakeForTicket(intakeDone),
          messageForTenant: params.conclusion.trim(),
          autoConclusion: {
            at: new Date().toISOString(),
            grockState: 'bailleur_responsable',
          },
          verdictLabel: 'VERDICT_BAILLEUR',
        }) as object,
      },
    });

    await this.handoff.dispatchSectorTechnician({
      ticketId: params.ticketId,
      intake: intakeDone,
      reason:
        params.reason?.trim() ||
        'Auto-conclusion Grock — intervention à la charge du bailleur.',
      visualizationNote: params.visualizationNote,
    });

    await this.prisma.ticket.update({
      where: { id: params.ticketId },
      data: { responsibility: 'BAILLEUR' },
    });

    this.logger.log(
      `Auto-conclusion bailleur ticket #${params.ticketId} → technicien secteur`,
    );
  }

  async finalizeTicketForSinistre(params: {
    ticketId: number;
    intake: LiaIntakeState;
    conclusion: string;
    reason?: string;
    visualizationNote?: string;
    noteInterne?: string | null;
  }): Promise<void> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: params.ticketId },
      select: { aiLastDecision: true },
    });
    if (!ticket) return;

    const intakeDone: LiaIntakeState = {
      ...params.intake,
      phase: 'DONE',
      answers: {
        ...params.intake.answers,
        jarvis_intake_complete: 'oui',
        jarvis_auto_conclusion: 'sinistre',
      },
    };

    await this.prisma.ticket.update({
      where: { id: params.ticketId },
      data: {
        responsibility: 'BAILLEUR',
        status: 'OPEN',
        aiLastDecision: mergeAiLastDecision(ticket.aiLastDecision, {
          intake: sanitizeIntakeForTicket(intakeDone),
          messageForTenant: params.conclusion.trim(),
          autoConclusion: {
            at: new Date().toISOString(),
            grockState: 'sinistre',
          },
          sinistre: {
            type: 'degats_eaux',
            insuranceDeclarationRequired: true,
            declarationDeadlineDays: 5,
            noteInterne: params.noteInterne?.trim() || undefined,
          },
          verdictLabel: 'VERDICT_SINISTRE',
        }) as object,
      },
    });

    await this.handoff.dispatchSectorTechnician({
      ticketId: params.ticketId,
      intake: intakeDone,
      reason:
        params.reason?.trim() ||
        'Auto-conclusion Grock — sinistre dégât des eaux, coordination bailleur.',
      visualizationNote: params.visualizationNote,
    });

    this.logger.log(
      `Auto-conclusion sinistre ticket #${params.ticketId} → technicien secteur + piste assurance`,
    );
  }

  async finalizeTicketAsNonRecevable(
    ticketId: number,
    meta: NonRecevableTicketMeta,
  ): Promise<void> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { aiLastDecision: true },
    });
    if (!ticket) return;

    const closedAt = new Date();
    const intakeDone: LiaIntakeState | undefined = meta.intake
      ? {
          ...meta.intake,
          phase: 'DONE',
          answers: {
            ...meta.intake.answers,
            jarvis_intake_complete: 'oui',
            jarvis_auto_conclusion: 'locataire_responsable',
          },
        }
      : undefined;

    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: 'AUTO_CLOSED',
        responsibility: 'LOCATAIRE',
        aiLastDecision: mergeAiLastDecision(ticket.aiLastDecision, {
          ...(intakeDone
            ? { intake: sanitizeIntakeForTicket(intakeDone) }
            : {}),
          resolution: 'non_recevable',
          messageForTenant: meta.conclusion?.trim(),
          closedAt: closedAt.toISOString(),
          meta,
          verdictLabel: 'VERDICT_LOCATAIRE',
        }) as object,
      },
    });

    this.logger.log(
      `[TICKET] ${ticketId} clôturé (non recevable / locataire responsable)`,
    );
  }
}
