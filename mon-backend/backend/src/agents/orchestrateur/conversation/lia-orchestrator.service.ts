import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { LiaConversationService } from './lia-conversation.service';
import { LiaIntakeService } from '../intake/lia-intake.service';
import { FeatureFlagsService } from '../../../feature-flags/feature-flags.service';
import type { QualificationFlags } from '../../../feature-flags/qualification-flags.types';
import { LiaAgentService } from './lia-agent.service';
import { LiaSharedStateService } from './lia-shared-state.service';
import { LiaDiagnosticCapabilityService } from '../../diagnostiqueur/capability/lia-diagnostic-capability.service';

/**
 * Chef d'orchestre LIA — shell synchrone minimal, pilotage 100 % agent (Goals + SharedState).
 */
@Injectable()
export class LiaOrchestratorService {
  private readonly logger = new Logger(LiaOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly conversation: LiaConversationService,
    private readonly intake: LiaIntakeService,
    private readonly featureFlags: FeatureFlagsService,
    private readonly agent: LiaAgentService,
    private readonly sharedState: LiaSharedStateService,
    private readonly diagnostic: LiaDiagnosticCapabilityService,
  ) {}

  private async qualFlags(landlordProfileId: number | null): Promise<QualificationFlags> {
    if (landlordProfileId == null) {
      return this.featureFlags.pickQualificationFlags({});
    }
    return this.featureFlags.getQualificationFlags(landlordProfileId);
  }

  /**
   * Démarre le fil : accueil synchrone, puis agent.react(TICKET_OPENED).
   */
  async startTicketConversation(ticketId: number, tenantUserId: number) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        tenant: { include: { user: true } },
      },
    });
    if (!ticket) throw new Error('Ticket introuvable');

    const flags = await this.qualFlags(ticket.landlordProfileId);

    await this.conversation.appendMessage(
      ticketId,
      'TENANT',
      this.formatInitialTenantMessage(ticket.title, ticket.description),
    );

    const intro = this.intake.welcomeIntro(ticket.tenant.firstName);
    await this.conversation.appendMessage(ticketId, 'LIA_HOST', intro);

    const ticketRefs = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        caseNumber: true,
        tenant: { select: { dossierNumber: true } },
      },
    });
    if (ticketRefs?.caseNumber) {
      const dossier = ticketRefs.tenant.dossierNumber ?? '—';
      await this.conversation.appendMessage(
        ticketId,
        'LIA_SYSTEM',
        `Numéro d’affaire : ${ticketRefs.caseNumber}\n` +
          `Dossier locataire : ${dossier}\n` +
          `Conservez ce numéro pour toute question avec le bailleur.`,
      );
    }

    const intakeState = flags.liaConversationEnabled
      ? this.intake.createInitialState(ticket.title, ticket.description)
      : this.intake.skipConversationIntake(
          ticket.title,
          ticket.description,
          flags.requirePhotoEvidence,
        );

    await this.sharedState.seedInitialState(ticketId, intakeState, 'OPEN');

    await this.agent.react(ticketId, tenantUserId, 'TICKET_OPENED');

    setImmediate(() => {
      void this.notifications
        .notifyUser(
          ticket.tenant.userId,
          {
            title: 'Lia vous accompagne',
            message: ticketRefs?.caseNumber
              ? `[${ticketRefs.caseNumber}] Quelques questions avant l’analyse de votre dossier.`
              : 'Quelques questions avant l’analyse de votre dossier.',
            type: 'INFO',
          },
          {
            sendPush: true,
            ticketId,
            caseNumber: ticketRefs?.caseNumber ?? undefined,
          },
        )
        .catch((e) => this.logger.warn('Notification accueil Lia', e));
    });

    return this.conversation.listMessages(ticketId, tenantUserId, 'LOCATAIRE');
  }

  /**
   * Message locataire — pilotage réactif par objectifs (Goals + SharedState).
   */
  async onTenantMessage(ticketId: number, tenantUserId: number, text: string) {
    await this.conversation.assertCanAccessTicket(
      ticketId,
      tenantUserId,
      'LOCATAIRE',
    );

    const trimmed = text.trim();
    await this.conversation.appendMessage(ticketId, 'TENANT', trimmed);

    await this.agent.react(ticketId, tenantUserId, 'TENANT_MESSAGE', {
      tenantMessage: trimmed,
    });

    return this.conversation.listMessages(ticketId, tenantUserId, 'LOCATAIRE');
  }

  /** Photo reçue — déclenche l’objectif RUN_DIAGNOSTIC via l’agent. */
  async onPhotoUploaded(
    ticketId: number,
    tenantUserId: number,
    photoUrl: string,
    feedback?: string,
  ) {
    await this.conversation.assertCanAccessTicket(
      ticketId,
      tenantUserId,
      'LOCATAIRE',
    );

    await this.agent.react(ticketId, tenantUserId, 'PHOTO_UPLOADED', {
      tenantMessage: feedback,
      photoUrl,
    });
  }

  /** Analyse patho/juriste (pipeline existant) sans bloquer la requête HTTP. */
  runAnalysisInBackground(ticketId: number, tenantFeedback?: string) {
    this.diagnostic.schedule(ticketId, tenantFeedback);
  }

  private formatInitialTenantMessage(title: string, description: string): string {
    const t = title.trim();
    const d = description.trim();
    if (!d) return t;
    if (!t || t === d) return d;
    const tBase = t.replace(/…$/u, '').trim();
    if (d.includes(tBase) && tBase.length > 10) return d;
    if (t.includes(d)) return t;
    return `${t}\n\n${d}`;
  }
}
