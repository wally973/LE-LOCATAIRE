import { Injectable } from '@nestjs/common';
import { DiagnosticContextService } from '../agents/shared/diagnostic-context.service';
import type { TicketDiagnosticContext } from '../agents/shared/diagnostic-context.service';
import {
  resolveAiCategoryFromContext,
  resolveSeverityFromContext,
} from '../agents/shared/diagnostic-ticket-insights';
import { detectSocialSignal } from '../agents/shared/social-signal-detection';

export interface SupportClassification {
  category: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  ticketId?: number;
  savoirVoirPhase?: string;
  aiCategory?: string;
}

@Injectable()
export class AiSupportService {
  constructor(
    private readonly diagnosticContext: DiagnosticContextService,
  ) {}

  async classifySupportMessage(content: string) {
    const ctx = this.diagnosticContext.fromParts({
      ticketId: 0,
      title: 'Support',
      description: content,
      aiLastDecision: null,
    });
    return this.classifyFromContext(ctx);
  }

  async classifySupportForTicket(ticketId: number): Promise<SupportClassification> {
    const ctx = await this.diagnosticContext.fromTicket(ticketId);
    return this.classifyFromContext(ctx);
  }

  private classifyFromContext(
    ctx: TicketDiagnosticContext,
  ): SupportClassification {
    if (detectSocialSignal(ctx.caseContext)) {
      return {
        category: 'SOCIAL',
        priority: 'HIGH',
        ticketId: ctx.ticketId || undefined,
        savoirVoirPhase: ctx.savoirVoirPhase,
      };
    }

    const severity = resolveSeverityFromContext(ctx);
    const aiCategory = resolveAiCategoryFromContext(ctx);

    if (severity === 'URGENT_CRITIQUE' || severity === 'HIGH') {
      return {
        category: 'URGENCE',
        priority: 'HIGH',
        ticketId: ctx.ticketId || undefined,
        savoirVoirPhase: ctx.savoirVoirPhase,
        aiCategory,
      };
    }

    const billingHint = /facture|paiement|quittance|loyer/i.test(
      ctx.caseContext,
    );
    if (billingHint) {
      return {
        category: 'FACTURATION',
        priority: 'MEDIUM',
        ticketId: ctx.ticketId || undefined,
        savoirVoirPhase: ctx.savoirVoirPhase,
        aiCategory,
      };
    }

    return {
      category: 'GENERAL',
      priority: severity === 'MEDIUM' ? 'MEDIUM' : 'LOW',
      ticketId: ctx.ticketId || undefined,
      savoirVoirPhase: ctx.savoirVoirPhase,
      aiCategory,
    };
  }

  async generateAutoReply(content: string, opts?: { ticketId?: number }) {
    const classification = opts?.ticketId
      ? await this.classifySupportForTicket(opts.ticketId)
      : await this.classifySupportMessage(content);

    if (classification.category === 'SOCIAL') {
      return 'Votre situation relève du volet social. Un référent dédié va reprendre contact avec vous.';
    }

    if (classification.category === 'URGENCE') {
      return 'Votre demande a été classée comme urgente. Un agent va la traiter dans les plus brefs délais.';
    }

    if (classification.category === 'FACTURATION') {
      return 'Nous avons bien reçu votre demande concernant la facturation. Un agent reviendra vers vous rapidement.';
    }

    return 'Merci pour votre message. Nous l’avons bien reçu et nous reviendrons vers vous dès que possible.';
  }
}
