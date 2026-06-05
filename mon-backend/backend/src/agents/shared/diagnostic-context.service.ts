import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildTenantCaseContext,
  splitPipelineFeedback,
} from './lia-case-context';
import { extractDiagnosticSensors } from './lia-diagnostic-sensors';
import type { DiagnosticSensors } from './lia-diagnostic-state.types';
import {
  parseDiagnosticState,
  type DiagnosticState,
} from './lia-diagnostic-state.types';
import { parseIntakeState, type LiaIntakeState } from '../orchestrateur/intake/lia-intake.service';
import type { SavoirVoirPhase } from './savoir-voir.types';
import type { LiaTenantSocialContext } from './lia-jarvis-identity';
import { loadTenantSocialContext } from './lia-tenant-social-context';

/** Contexte diagnostic unifié — capteurs + cas locataire (tous les agents IA). */
export interface TicketDiagnosticContext {
  ticketId: number;
  title: string;
  description: string;
  diagnostic: DiagnosticState | null;
  /** Toujours défini (objet vide si rien extrait). */
  sensors: DiagnosticSensors;
  caseContext: string;
  intake: LiaIntakeState | null;
  savoirVoirPhase: SavoirVoirPhase;
  tenantSupplement: string;
  /** Profil social locataire — miroir relationnel pour Groq / agents. */
  tenantSocial: LiaTenantSocialContext | null;
}

function resolveSavoirVoirPhase(
  diagnostic: DiagnosticState | null,
): SavoirVoirPhase {
  if (!diagnostic?.hypotheses?.length) return 'OBSERVATION';
  const eliminated = diagnostic.hypotheses.filter((h) => h.eliminated);
  const active = diagnostic.hypotheses.filter((h) => !h.eliminated);
  if (!eliminated.length && !active.length) return 'OBSERVATION';
  if (eliminated.length && !diagnostic.leadingHypothesisId) return 'ELIMINATION';
  if (diagnostic.leadingHypothesisId && active.length) return 'HYPOTHESES';
  return 'CONCLUSION';
}

@Injectable()
export class DiagnosticContextService {
  constructor(private readonly prisma: PrismaService) {}

  /** Charge le contexte depuis un ticket persisté. */
  async fromTicket(
    ticketId: number,
    opts?: { tenantFeedback?: string },
  ): Promise<TicketDiagnosticContext> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        title: true,
        description: true,
        aiLastDecision: true,
        tenantId: true,
      },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket introuvable');
    }
    const tenantSocial = await loadTenantSocialContext(this.prisma, {
      tenantId: ticket.tenantId,
      excludeTicketId: ticket.id,
      currentTitle: ticket.title,
    });
    return this.fromParts({
      ticketId: ticket.id,
      title: ticket.title,
      description: ticket.description,
      aiLastDecision: ticket.aiLastDecision,
      tenantFeedback: opts?.tenantFeedback,
      tenantSocial,
    });
  }

  /** Assemble le contexte à partir de champs déjà chargés (routing, agent). */
  fromParts(params: {
    ticketId: number;
    title: string;
    description: string;
    aiLastDecision: unknown;
    tenantFeedback?: string;
    tenantSocial?: LiaTenantSocialContext | null;
  }): TicketDiagnosticContext {
    const intake = parseIntakeState(params.aiLastDecision);
    const diagnostic = parseDiagnosticState(params.aiLastDecision);

    const feedbackMerged = [
      params.description,
      params.tenantFeedback ?? '',
    ]
      .filter(Boolean)
      .join('\n\n');
    const { tenantSupplement } = splitPipelineFeedback(feedbackMerged);

    const caseContext = buildTenantCaseContext({
      title: params.title,
      description: params.description,
      intake,
      tenantSupplement,
    });

    const sensorsFromDiagnostic = diagnostic?.sensors ?? {};
    const extracted = extractDiagnosticSensors({
      contextText: [params.title, params.description, caseContext].join('\n'),
      intakeAnswers: intake?.answers,
    });
    const sensors: DiagnosticSensors = {
      ...extracted,
      ...sensorsFromDiagnostic,
    };

    const savoirVoirPhase = resolveSavoirVoirPhase(
      diagnostic
        ? { ...diagnostic, sensors }
        : null,
    );

    return {
      ticketId: params.ticketId,
      title: params.title,
      description: params.description,
      diagnostic: diagnostic ? { ...diagnostic, sensors } : null,
      sensors,
      caseContext,
      intake,
      savoirVoirPhase,
      tenantSupplement,
      tenantSocial: params.tenantSocial ?? null,
    };
  }
}
