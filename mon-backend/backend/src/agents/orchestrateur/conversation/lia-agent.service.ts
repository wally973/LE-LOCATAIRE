import {
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ArtisanRequestsService } from '../../../artisan-requests/artisan-requests.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { LiaHostService } from './lia-host.service';
import { LiaConversationService } from './lia-conversation.service';
import { LiaComprehensionService } from './lia-comprehension.service';
import { LiaDiagnosticCapabilityService } from '../../diagnostiqueur/capability/lia-diagnostic-capability.service';
import { LiaSharedStateService } from './lia-shared-state.service';
import { LiaCompanionService } from './lia-companion.service';
import {
  buildIntakePayload,
  mergeAiLastDecision,
  parseIntakeState,
  type LiaIntakeState,
} from '../intake/lia-intake.service';
import { parseCompanionState, toCompanionUiState } from './lia-companion.types';
import { buildArtisanDeclinedLandlordNote } from '../../chercheur/research/lia-landlord-history';
import {
  isArtisanIntent,
  isDeclineArtisanIntent,
  isSkipPhotoIntent,
  resolveArtisanLabel,
} from './lia-agent-intents';
import {
  type AgentTrigger,
  type GoalExecutionResult,
  type LiaGoal,
  type LiaSharedState,
  goalCompleted,
  markGoalDone,
} from './lia-goals.types';
import {
  buildMissingCriticalSensorsMessage,
  getMissingCriticalSensors,
} from '../../shared/critical-diagnostic-sensors';
import { detectSocialSignal } from '../../shared/social-signal-detection';

/**
 * Agent LIA autonome — choisit le prochain objectif depuis le SharedState (réactif).
 * Compréhension et diagnostic délégués aux capacités existantes.
 */
@Injectable()
export class LiaAgentService {
  private readonly logger = new Logger(LiaAgentService.name);

  constructor(
    private readonly sharedState: LiaSharedStateService,
    private readonly comprehension: LiaComprehensionService,
    private readonly diagnostic: LiaDiagnosticCapabilityService,
    private readonly conversation: LiaConversationService,
    private readonly host: LiaHostService,
    private readonly artisanRequests: ArtisanRequestsService,
    private readonly notifications: NotificationsService,
    private readonly companion: LiaCompanionService,
    private readonly prisma: PrismaService,
  ) {}

  /** Boucle réactive : plusieurs objectifs peuvent s’enchaîner dans une passe. */
  async react(
    ticketId: number,
    tenantUserId: number,
    trigger: AgentTrigger,
    opts?: { tenantMessage?: string; photoUrl?: string },
  ): Promise<void> {
    let state = await this.sharedState.load(ticketId, tenantUserId, {
      lastTenantMessage: opts?.tenantMessage,
    });
    state.agent.lastTrigger = trigger;

    for (let i = 0; i < 6; i++) {
      const goal = this.decideNextGoal(state, trigger);
      if (!goal) break;
      if (goal === state.agent.lastGoal && trigger === 'INTERNAL') break;

      const result = await this.executeGoal(goal, state, trigger, opts?.photoUrl);
      state = result.state;
      await this.sharedState.persistAgentMemory(
        ticketId,
        state.agent,
        state.intake ?? undefined,
      );

      if (!result.continueLoop) break;
      trigger = 'INTERNAL';
    }
  }

  /** Décision non linéaire : le prochain objectif dépend de l’état, pas d’un stepIndex. */
  decideNextGoal(state: LiaSharedState, trigger: AgentTrigger): LiaGoal | null {
    const msg = state.lastTenantMessage?.trim() ?? '';

    if (state.followUpClosed) {
      if (trigger === 'TENANT_MESSAGE' && msg) return 'ACKNOWLEDGE_TENANT';
      return null;
    }

    if (state.diagnosticAuthority === 'EXPERT_VALIDATED') {
      if (trigger === 'TENANT_MESSAGE' && msg) return 'ACKNOWLEDGE_TENANT';
      return null;
    }

    if (trigger === 'TENANT_MESSAGE' && msg) {
      if (state.intake?.answers.topic_change_confirmed === 'oui') {
        return 'ISOLATE_WRONG_TOPIC';
      }
      if (isDeclineArtisanIntent(msg) || isArtisanIntent(msg)) {
        return 'RESOLVE_ARTISAN_INTENT';
      }
    }

    if (
      !goalCompleted(state, 'COMPREHEND_SITUATION') &&
      state.intake
    ) {
      return 'COMPREHEND_SITUATION';
    }

    if (state.intake?.phase === 'INTAKE') {
      return 'COLLECT_MISSING_FACTS';
    }

    if (state.intake?.phase === 'AWAITING_PHOTO') {
      if (trigger === 'PHOTO_UPLOADED') return 'RUN_DIAGNOSTIC';
      if (trigger === 'TICKET_OPENED') return 'COLLECT_MISSING_FACTS';
      if (
        trigger === 'TENANT_MESSAGE' &&
        msg &&
        (!state.flags.requirePhotoEvidence || isSkipPhotoIntent(msg))
      ) {
        return 'RUN_DIAGNOSTIC';
      }
      if (trigger === 'TENANT_MESSAGE' && msg) {
        return 'OBTAIN_VISUAL_EVIDENCE';
      }
      return null;
    }

    if (
      state.intake?.phase === 'DONE' &&
      trigger === 'TICKET_OPENED' &&
      goalCompleted(state, 'COMPREHEND_SITUATION')
    ) {
      return 'RUN_DIAGNOSTIC';
    }

    if (state.responsibility === 'PENDING') {
      if (
        trigger === 'TENANT_MESSAGE' &&
        msg &&
        (state.intake?.phase === 'DONE' || !state.intake)
      ) {
        return 'RUN_DIAGNOSTIC';
      }
      if (
        goalCompleted(state, 'COLLECT_MISSING_FACTS') ||
        goalCompleted(state, 'OBTAIN_VISUAL_EVIDENCE') ||
        trigger === 'PHOTO_UPLOADED'
      ) {
        return 'RUN_DIAGNOSTIC';
      }
    }

    if (
      trigger === 'TENANT_MESSAGE' &&
      msg &&
      state.responsibility !== 'PENDING'
    ) {
      return 'ACKNOWLEDGE_TENANT';
    }

    return null;
  }

  private async executeGoal(
    goal: LiaGoal,
    state: LiaSharedState,
    trigger: AgentTrigger,
    photoUrl?: string,
  ): Promise<GoalExecutionResult> {
    switch (goal) {
      case 'COMPREHEND_SITUATION':
        return this.goalComprehendSituation(state);
      case 'COLLECT_MISSING_FACTS':
        return this.goalCollectFacts(state, trigger);
      case 'OBTAIN_VISUAL_EVIDENCE':
        return this.goalObtainPhoto(state, trigger);
      case 'RUN_DIAGNOSTIC':
        return this.goalRunDiagnostic(state, trigger, photoUrl);
      case 'ISOLATE_WRONG_TOPIC':
        return this.goalIsolateWrongTopic(state);
      case 'RESOLVE_ARTISAN_INTENT':
        return this.goalResolveArtisan(state);
      case 'ACKNOWLEDGE_TENANT':
        return this.goalAcknowledgeTenant(state);
      case 'COMPLETE_DOSSIER':
        return this.goalCompleteDossier(state);
      default:
        return { state, continueLoop: false };
    }
  }

  private async goalComprehendSituation(
    state: LiaSharedState,
  ): Promise<GoalExecutionResult> {
    if (!state.intake) return { state, continueLoop: false };
    await this.comprehension.appendSituationAnalysis(
      state.ticketId,
      state.tenantFirstName,
      state.title,
      state.description,
      state.intake,
    );
    this.scheduleCompanion(state, state.intake);
    return {
      state: {
        ...state,
        agent: markGoalDone(state, 'COMPREHEND_SITUATION'),
      },
      continueLoop: true,
    };
  }

  private async goalCollectFacts(
    state: LiaSharedState,
    trigger: AgentTrigger,
  ): Promise<GoalExecutionResult> {
    let intake = state.intake;
    if (!intake) return { state, continueLoop: false };

    if (trigger === 'TENANT_MESSAGE' && state.lastTenantMessage) {
      const turn = await this.comprehension.processTenantReply({
        state: intake,
        message: state.lastTenantMessage,
        title: state.title,
        description: state.description,
        tenantFirstName: state.tenantFirstName,
      });
      intake = turn.state;
      const parts: string[] = [];
      if (turn.acknowledgment) parts.push(turn.acknowledgment);
      if (turn.nextQuestionText) parts.push(turn.nextQuestionText);
      if (parts.length > 0) {
        await this.conversation.appendMessage(
          state.ticketId,
          'LIA_HOST',
          parts.join('\n\n'),
        );
      }
      await this.persistIntake(
        state.ticketId,
        intake,
        intake.phase === 'AWAITING_PHOTO' ? 'AWAITING_TENANT_PHOTO' : 'OPEN',
      );
      if (intake.answers.topic_change_confirmed === 'oui') {
        return this.goalIsolateWrongTopic({ ...state, intake });
      }
      if (intake.phase === 'DONE') {
        return this.goalRunDiagnostic({ ...state, intake }, trigger);
      }
      return {
        state: {
          ...state,
          intake,
          agent: markGoalDone(state, 'COLLECT_MISSING_FACTS'),
        },
        continueLoop: false,
      };
    } else if (trigger === 'TICKET_OPENED' && intake.phase === 'INTAKE') {
      const q = this.comprehension.currentQuestion(intake);
      if (q) {
        await this.conversation.appendMessage(
          state.ticketId,
          'LIA_HOST',
          q.text,
        );
        await this.persistIntake(state.ticketId, intake, 'OPEN');
      }
      return {
        state: { ...state, intake },
        continueLoop: false,
      };
    }

    if (intake.phase === 'INTAKE') {
      const q = this.comprehension.currentQuestion(intake);
      if (q && trigger !== 'TENANT_MESSAGE') {
        await this.conversation.appendMessage(
          state.ticketId,
          'LIA_HOST',
          q.text,
        );
      }
      await this.persistIntake(state.ticketId, intake, 'OPEN');
      return {
        state: {
          ...state,
          intake,
          agent: markGoalDone(state, 'COLLECT_MISSING_FACTS'),
        },
        continueLoop: false,
      };
    }

    if (intake.phase === 'AWAITING_PHOTO') {
      if (
        trigger === 'TENANT_MESSAGE' &&
        state.lastTenantMessage &&
        (!state.flags.requirePhotoEvidence ||
          isSkipPhotoIntent(state.lastTenantMessage))
      ) {
        return this.goalRunDiagnostic({ ...state, intake }, trigger);
      }
      await this.conversation.appendMessage(
        state.ticketId,
        'LIA_HOST',
        this.comprehension.photoRequestText(intake),
      );
      await this.persistIntake(state.ticketId, intake, 'AWAITING_TENANT_PHOTO');
      return {
        state: {
          ...state,
          intake,
          agent: markGoalDone(state, 'COLLECT_MISSING_FACTS'),
        },
        continueLoop: false,
      };
    }

    if (intake.phase === 'DONE') {
      return this.goalRunDiagnostic({ ...state, intake }, trigger);
    }

    return { state: { ...state, intake }, continueLoop: false };
  }

  private async goalObtainPhoto(
    state: LiaSharedState,
    trigger: AgentTrigger,
  ): Promise<GoalExecutionResult> {
    if (!state.intake) return { state, continueLoop: false };
    if (
      trigger === 'TENANT_MESSAGE' &&
      state.lastTenantMessage &&
      isSkipPhotoIntent(state.lastTenantMessage)
    ) {
      return this.goalRunDiagnostic(state, trigger);
    }
    if (trigger === 'TENANT_MESSAGE' && state.lastTenantMessage) {
      await this.conversation.appendMessage(
        state.ticketId,
        'LIA_HOST',
        this.comprehension.photoRequestText(state.intake),
      );
    }
    return {
      state: {
        ...state,
        agent: markGoalDone(state, 'OBTAIN_VISUAL_EVIDENCE'),
      },
      continueLoop: false,
    };
  }

  private async goalRunDiagnostic(
    state: LiaSharedState,
    trigger: AgentTrigger,
    photoUrl?: string,
  ): Promise<GoalExecutionResult> {
    let intake = state.intake;
    const skippingPhoto =
      trigger === 'TENANT_MESSAGE' &&
      !!state.lastTenantMessage &&
      (!state.flags.requirePhotoEvidence ||
        isSkipPhotoIntent(state.lastTenantMessage));

    if (intake && intake.phase !== 'DONE') {
      if (trigger === 'PHOTO_UPLOADED') {
        await this.sharedState.updateTicketStatus(
          state.ticketId,
          'LIA_ANALYZING',
        );
      } else {
        if (skippingPhoto && state.lastTenantMessage) {
          intake = this.comprehension.markDone({
            ...intake,
            answers: {
              ...intake.answers,
              photo_unavailable: state.lastTenantMessage.trim(),
            },
          });
        } else {
          intake = this.comprehension.markDone(intake);
        }
        await this.persistIntake(state.ticketId, intake, 'LIA_ANALYZING');

        if (skippingPhoto) {
          await this.conversation.appendMessage(
            state.ticketId,
            'LIA_HOST',
            this.comprehension.skipPhotoAck(),
          );
          await this.notifications.notifyUser(
            state.tenantUserId,
            {
              title: 'Analyse de votre dossier',
              message:
                'Lia analyse vos réponses. Vous serez notifié(e) du résultat.',
              type: 'INFO',
            },
            { sendPush: true, ticketId: state.ticketId },
          );
        }
      }
    } else if (!intake || intake.phase === 'DONE') {
      await this.sharedState.updateTicketStatus(
        state.ticketId,
        'LIA_ANALYZING',
      );
    }

    const signalementText = `${state.title} ${state.description} ${state.lastTenantMessage ?? ''}`;
    if (detectSocialSignal(signalementText)) {
      this.diagnostic.schedule(state.ticketId, signalementText, photoUrl);
      return {
        state: {
          ...state,
          intake,
          agent: markGoalDone(state, 'RUN_DIAGNOSTIC'),
        },
        continueLoop: false,
      };
    }

    const missingSensors = getMissingCriticalSensors({
      title: state.title,
      description: state.description,
      sensors: state.sensors,
      intakeAnswers: intake?.answers,
    });
    if (missingSensors.length > 0) {
      const prompt = buildMissingCriticalSensorsMessage(missingSensors);
      await this.conversation.appendMessage(
        state.ticketId,
        'LIA_HOST',
        prompt,
      );
      if (intake && intake.phase !== 'INTAKE') {
        intake = { ...intake, phase: 'INTAKE' };
        await this.persistIntake(state.ticketId, intake, 'OPEN');
      }
      return {
        state: { ...state, intake },
        continueLoop: false,
      };
    }

    const feedback =
      trigger === 'TENANT_MESSAGE' ? state.lastTenantMessage : undefined;
    this.diagnostic.schedule(state.ticketId, feedback, photoUrl);

    return {
      state: {
        ...state,
        intake,
        agent: markGoalDone(state, 'RUN_DIAGNOSTIC'),
      },
      continueLoop: false,
    };
  }

  private async goalIsolateWrongTopic(
    state: LiaSharedState,
  ): Promise<GoalExecutionResult> {
    const wrongTopic =
      !!state.lastTenantMessage &&
      !!state.intake &&
      this.comprehension.isWrongTopicMessage(
        state.lastTenantMessage,
        state.title,
        state.description,
        state.intake,
      );

    await this.conversation.appendMessage(
      state.ticketId,
      'LIA_HOST',
      state.followUpClosed
        ? this.comprehension.closedDossierReply()
        : wrongTopic
          ? this.comprehension.wrongTopicReply(state.intake)
          : this.comprehension.closedDossierReply(),
    );

    if (
      wrongTopic &&
      !state.followUpClosed &&
      state.intake?.answers.topic_change_confirmed === 'oui'
    ) {
      await this.closeFollowUp(state.ticketId);
      state = { ...state, followUpClosed: true };
    }

    return {
      state: {
        ...state,
        agent: markGoalDone(state, 'ISOLATE_WRONG_TOPIC'),
      },
      continueLoop: false,
    };
  }

  private async goalResolveArtisan(
    state: LiaSharedState,
  ): Promise<GoalExecutionResult> {
    const msg = state.lastTenantMessage ?? '';
    if (isDeclineArtisanIntent(msg)) {
      await this.conversation.appendMessage(
        state.ticketId,
        'LIA_HOST',
        'Très bien, nous n’ouvrons pas de demande d’artisan pour ce dossier. ' +
          'Pour signaler un autre problème, créez une nouvelle demande depuis l’accueil. ' +
          'Vous retrouverez ce diagnostic dans « Mes demandes ».',
      );
      await this.closeFollowUp(state.ticketId);
      return {
        state: {
          ...state,
          followUpClosed: true,
          artisanDeclined: true,
          agent: markGoalDone(state, 'RESOLVE_ARTISAN_INTENT'),
        },
        continueLoop: false,
      };
    }

    const label = resolveArtisanLabel(msg);
    let reply: string;
    if (state.responsibility !== 'LOCATAIRE') {
      reply =
        state.responsibility === 'BAILLEUR' ||
        state.responsibility === 'ESCALADE_BAILLEUR'
          ? 'Cette intervention est à la charge du bailleur : un agent va vous recontacter. ' +
            'Vous n’avez pas besoin de commander un artisan vous-même.'
          : 'Pour l’instant, une demande d’artisan n’est pas possible sur ce dossier. ' +
            'Un agent du bailleur va vous accompagner.';
    } else {
      try {
        await this.artisanRequests.createFromTicket(
          state.tenantUserId,
          state.ticketId,
          { reason: msg },
        );
        const r = await this.host.confirmArtisanRequest({ artisanLabel: label });
        reply = r.text;
      } catch (e) {
        if (e instanceof ConflictException) {
          const r = await this.host.confirmArtisanRequest({
            artisanLabel: label,
            alreadyExists: true,
          });
          reply = r.text;
        } else {
          this.logger.error(`Artisan ticket #${state.ticketId}`, e);
          reply =
            'Je n’ai pas pu enregistrer la demande d’artisan pour le moment. ' +
            'Réessayez dans un instant ou contactez votre bailleur.';
        }
      }
    }

    await this.conversation.appendMessage(state.ticketId, 'LIA_HOST', reply);
    return {
      state: {
        ...state,
        agent: markGoalDone(state, 'RESOLVE_ARTISAN_INTENT'),
      },
      continueLoop: false,
    };
  }

  private async goalAcknowledgeTenant(
    state: LiaSharedState,
  ): Promise<GoalExecutionResult> {
    const ack = await this.host.acknowledgeTenantReply({
      tenantMessage: state.lastTenantMessage ?? '',
    });
    await this.conversation.appendMessage(state.ticketId, 'LIA_HOST', ack.text);
    return {
      state: {
        ...state,
        agent: markGoalDone(state, 'ACKNOWLEDGE_TENANT'),
      },
      continueLoop: false,
    };
  }

  private async goalCompleteDossier(
    state: LiaSharedState,
  ): Promise<GoalExecutionResult> {
    await this.closeFollowUp(state.ticketId);
    return {
      state: {
        ...state,
        followUpClosed: true,
        agent: markGoalDone(state, 'COMPLETE_DOSSIER'),
      },
      continueLoop: false,
    };
  }

  private async persistIntake(
    ticketId: number,
    intake: LiaIntakeState,
    status: 'OPEN' | 'AWAITING_TENANT_PHOTO' | 'LIA_ANALYZING',
  ): Promise<void> {
    const row = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { aiLastDecision: true },
    });
    const companion = parseCompanionState(row?.aiLastDecision) ?? undefined;
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status,
        aiLastDecision: buildIntakePayload(intake, companion) as object,
      },
    });
  }

  private scheduleCompanion(state: LiaSharedState, intake: LiaIntakeState): void {
    setImmediate(() => {
      void this.companion
        .produceGuidance({
          title: state.title,
          description: state.description,
          category: intake.category,
          tenantFirstName: state.tenantFirstName,
          tenantMessage: state.lastTenantMessage,
        })
        .then(async (res) => {
          const row = await this.prisma.ticket.findUnique({
            where: { id: state.ticketId },
            select: { aiLastDecision: true },
          });
          const current = parseIntakeState(row?.aiLastDecision) ?? intake;
          await this.prisma.ticket.update({
            where: { id: state.ticketId },
            data: {
              aiLastDecision: buildIntakePayload(
                current,
                toCompanionUiState(res),
              ) as object,
            },
          });
        })
        .catch((e) =>
          this.logger.warn(`Companion ticket ${state.ticketId}`, e),
        );
    });
  }

  private async closeFollowUp(ticketId: number): Promise<void> {
    const row = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        aiLastDecision: true,
        responsibility: true,
        title: true,
      },
    });
    const note = buildArtisanDeclinedLandlordNote({
      responsibility: row?.responsibility ?? null,
      title: row?.title ?? '',
      aiLastDecision: row?.aiLastDecision,
    });
    const prev = row?.aiLastDecision as { landlordHistoryNotes?: unknown } | null;
    const notes = Array.isArray(prev?.landlordHistoryNotes)
      ? [...prev.landlordHistoryNotes, note]
      : [note];
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        aiLastDecision: mergeAiLastDecision(row?.aiLastDecision, {
          followUpClosed: true,
          artisanDeclined: true,
          artisanDeclinedAt: note.at,
          landlordHistoryNotes: notes,
        }) as object,
      },
    });
  }
}
