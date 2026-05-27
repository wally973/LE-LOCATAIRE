import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AiRoutingService } from '../../../ai-routing/ai-routing.service';
import { FeatureFlagsService } from '../../../feature-flags/feature-flags.service';
import { LiaConversationService } from '../../orchestrateur/conversation/lia-conversation.service';
import { LiaResearchService } from '../../chercheur/research/lia-research.service';
import { isExpertValidated } from '../briefing/lia-expert-rectification.types';
import { parseIntakeState } from '../../orchestrateur/intake/lia-intake.service';
import { buildJarvisDiagnosticEnrichment } from '../../orchestrateur/intake/lia-jarvis-reasoning';
import { uiStatusForResponsibility } from '../../orchestrateur/conversation/lia-message-ui-status';

/**
 * Capacité « diagnostic » — agents de raisonnement (pathologiste + juriste).
 * Le contexte Jarvis (simulation physique) enrichit l’analyse ; pas de chemin de questions.
 */
@Injectable()
export class LiaDiagnosticCapabilityService {
  private readonly logger = new Logger(LiaDiagnosticCapabilityService.name);
  private readonly analyzing = new Set<number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiRouting: AiRoutingService,
    private readonly conversation: LiaConversationService,
    private readonly research: LiaResearchService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  isRunning(ticketId: number): boolean {
    return this.analyzing.has(ticketId);
  }

  schedule(
    ticketId: number,
    tenantFeedback?: string,
    photoUrl?: string,
  ): void {
    if (this.analyzing.has(ticketId)) return;
    this.analyzing.add(ticketId);
    setImmediate(() => {
      void this.run(ticketId, tenantFeedback, photoUrl).finally(() => {
        this.analyzing.delete(ticketId);
      });
    });
  }

  async run(
    ticketId: number,
    tenantFeedback?: string,
    photoUrl?: string,
  ): Promise<void> {
    try {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { landlordProfileId: true, aiLastDecision: true },
      });
      if (isExpertValidated(ticket?.aiLastDecision)) {
        this.logger.log(
          `Ticket ${ticketId} : diagnostic expert validé — analyse IA ignorée.`,
        );
        return;
      }
      const flags = ticket?.landlordProfileId
        ? await this.featureFlags.getQualificationFlags(ticket.landlordProfileId)
        : await this.featureFlags.pickQualificationFlags({});

      const intake = parseIntakeState(ticket?.aiLastDecision);
      const jarvisCtx = buildJarvisDiagnosticEnrichment(intake);

      let feedback = [jarvisCtx, tenantFeedback].filter(Boolean).join('\n\n');
      if (flags.liaAutoResearchEnabled) {
        const brief = await this.research.buildInternalBrief(ticketId);
        feedback = [jarvisCtx, brief, tenantFeedback].filter(Boolean).join('\n\n');
      }

      const updated = await this.aiRouting.analyzeTicket(ticketId, {
        force: true,
        tenantFeedback: feedback,
        photoUrl,
      });

      const decision = updated.aiLastDecision as {
        messageForTenant?: string;
      } | null;
      const finalText =
        decision?.messageForTenant ??
        'Votre dossier a été analysé. Ouvrez l’application pour voir le détail.';

      const lastHost = await this.prisma.ticketMessage.findFirst({
        where: { ticketId, role: 'LIA_HOST' },
        orderBy: { createdAt: 'desc' },
      });
      if (lastHost?.content.trim() !== finalText.trim()) {
        const intake = parseIntakeState(updated.aiLastDecision);
        const lang = intake?.preferredLanguage === 'gcf' ? 'gcf' : 'fr';
        const uiStatus = uiStatusForResponsibility(
          updated.responsibility,
          lang,
        );
        await this.conversation.appendMessage(
          ticketId,
          'LIA_HOST',
          finalText,
          lang === 'gcf' ? 'gcf-GP' : 'fr-FR',
          uiStatus ? { uiStatus } : undefined,
        );
      }
    } catch (e) {
      this.logger.error(`Diagnostic ticket #${ticketId}`, e);
      await this.conversation.appendMessage(
        ticketId,
        'LIA_SYSTEM',
        'Une difficulté technique est survenue. Un agent du bailleur reprendra votre dossier.',
      );
    }
  }
}
