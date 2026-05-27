import { Injectable } from '@nestjs/common';
import { analyzingStatus } from '../conversation/lia-message-ui-status';
import {
  type IntakeReactiveTurn,
  type LiaIntakeState,
  LiaIntakeService,
} from './lia-intake.service';
import { isSkipPhotoIntent } from '../conversation/lia-agent-intents';
import {
  INTAKE_LANGUAGE_ANSWER_ID,
  isTenantLanguageGreeting,
  resolveLanguageFromGreeting,
} from '../../shared/lia-tenant-greeting';
import {
  buildTopicChangeConfirmationQuestion,
  detectJarvisDialogueIntent,
  detectedTopicLabelForConfirmation,
  parseTopicChangeConfirmation,
} from './lia-jarvis-intake.engine';
import { buildJarvisReassurance } from './lia-jarvis-intake.engine';
import { LiaJarvisPilotService } from './lia-jarvis-pilot.service';

/**
 * Intake réactif — pilote unique : Jarvis (lia-jarvis-intake.engine + pilot).
 */
@Injectable()
export class LiaIntakeReactiveService {
  constructor(
    private readonly intake: LiaIntakeService,
    private readonly jarvis: LiaJarvisPilotService,
  ) {}

  async processTenantReply(params: {
    state: LiaIntakeState;
    message: string;
    title: string;
    description: string;
    tenantFirstName?: string;
    ticketId?: number;
  }): Promise<IntakeReactiveTurn> {
    const msg = params.message.trim();
    if (!msg) {
      return {
        state: params.state,
        acknowledgment: null,
        nextQuestionText: null,
      };
    }

    if (
      isSkipPhotoIntent(msg) &&
      (params.state.phase === 'AWAITING_PHOTO' ||
        params.state.phase === 'INTAKE')
    ) {
      const done = this.intake.markDone({
        ...params.state,
        intakeMode: 'jarvis',
        answers: {
          ...params.state.answers,
          photo_unavailable: msg,
          jarvis_intake_complete: 'oui',
        },
      });
      const lang = done.preferredLanguage === 'gcf' ? 'gcf' : 'fr';
      return {
        state: done,
        acknowledgment:
          'C’est noté — j’analyse votre dossier avec votre description, sans photo.',
        nextQuestionText: null,
        uiStatus: analyzingStatus(lang),
      };
    }

    if (
      isTenantLanguageGreeting(msg) &&
      !params.state.answers[INTAKE_LANGUAGE_ANSWER_ID]
    ) {
      const language = resolveLanguageFromGreeting(msg);
      let state: LiaIntakeState = {
        ...params.state,
        intakeMode: 'jarvis',
        preferredLanguage: language,
        answers: {
          ...params.state.answers,
          [INTAKE_LANGUAGE_ANSWER_ID]: msg,
        },
      };
      const turn = await this.jarvis.runTenantTurn({
        state,
        message: msg,
        title: params.title,
        description: params.description,
        tenantFirstName: params.tenantFirstName,
        ticketId: params.ticketId,
      });
      return this.toReactiveTurn(turn);
    }

    let state: LiaIntakeState = {
      ...params.state,
      intakeMode: 'jarvis',
    };

    if (state.topicChangePending) {
      const decision = parseTopicChangeConfirmation(msg);
      if (decision === 'yes') {
        return {
          state: {
            ...state,
            answers: { ...state.answers, topic_change_confirmed: 'oui' },
          },
          acknowledgment:
            'Très bien. Pour ce second sujet, ouvrez une nouvelle demande depuis l’accueil ' +
            '(bouton « Déclarer un problème »).',
          nextQuestionText: null,
        };
      }
      if (decision === 'no') {
        state = {
          ...state,
          topicChangePending: false,
          pendingTopicLabel: undefined,
        };
      }
    }

    const intent = detectJarvisDialogueIntent(
      msg,
      params.title,
      params.description,
    );

    if (intent === 'topic_change_candidate') {
      const label =
        detectedTopicLabelForConfirmation(msg, state.category) ??
        'un autre sujet';
      return {
        state: {
          ...state,
          topicChangePending: true,
          pendingTopicLabel: label,
        },
        acknowledgment: buildJarvisReassurance({
          message: msg,
          state,
          tenantFirstName: params.tenantFirstName,
        }),
        nextQuestionText: buildTopicChangeConfirmationQuestion(label),
      };
    }

    const turn = await this.jarvis.runTenantTurn({
      state,
      message: msg,
      title: params.title,
      description: params.description,
      tenantFirstName: params.tenantFirstName,
      ticketId: params.ticketId,
    });

    return this.toReactiveTurn(turn);
  }

  private toReactiveTurn(
    turn: import('./lia-jarvis-pilot.service').JarvisPilotTurn,
  ): IntakeReactiveTurn {
    return {
      state: turn.state,
      acknowledgment: turn.acknowledgment,
      nextQuestionText: turn.nextQuestion,
      uiStatus: turn.uiStatus,
    };
  }
}
