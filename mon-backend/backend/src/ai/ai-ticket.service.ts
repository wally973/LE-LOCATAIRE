import { Injectable } from '@nestjs/common';
import { DiagnosticContextService } from '../agents/shared/diagnostic-context.service';
import {
  buildDiagnosticBrief,
  resolveAiCategoryFromContext,
  resolveSeverityFromContext,
} from '../agents/shared/diagnostic-ticket-insights';

@Injectable()
export class AiTicketService {
  constructor(
    private readonly diagnosticContext: DiagnosticContextService,
  ) {}

  /**
   * Analyse texte hors ticket (pré-création) — capteurs + domaine Savoir-Voir.
   * Le flux mobile complet passe par `ai-routing` après création du ticket.
   */
  async analyze(description: string, opts?: { title?: string }) {
    if (!description?.trim()) {
      return null;
    }

    const ctx = this.diagnosticContext.fromParts({
      ticketId: 0,
      title: opts?.title ?? 'Analyse',
      description,
      aiLastDecision: null,
    });

    return {
      category: resolveAiCategoryFromContext(ctx),
      severity: resolveSeverityFromContext(ctx),
      confidence: ctx.diagnostic?.differentialConfidence ?? 0.78,
      savoirVoirPhase: ctx.savoirVoirPhase,
      sensors: ctx.sensors,
    };
  }

  /** Analyse alignée sur le ticket persisté (intake + `aiLastDecision`). */
  async analyzeForTicket(ticketId: number) {
    const ctx = await this.diagnosticContext.fromTicket(ticketId);
    return buildDiagnosticBrief(ctx);
  }

  /**
   * Photo en buffer : non utilisé — vision via `AiPhotoService` / pathologiste.
   */
  async analyzeFromBuffer(_buffer: Buffer) {
    return null;
  }
}
