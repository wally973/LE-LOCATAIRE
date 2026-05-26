import { Injectable, Logger } from '@nestjs/common';
import { LiaLlmFirstComprehensionService } from '../../comprehension/lia-llm-first-comprehension.service';
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
  applyJarvis360ToState,
  buildJarvisReassurance,
  buildTopicChangeConfirmationQuestion,
  detectJarvisDialogueIntent,
  detectedTopicLabelForConfirmation,
  parseTopicChangeConfirmation,
} from './lia-jarvis-intake.engine';

/**
 * Intake réactif — mode LLM-first par défaut.
 * Les règles scriptées (questions GENERIC, extracteurs métier) ne s’appliquent plus au dialogue.
 */
@Injectable()
export class LiaIntakeReactiveService {
  private readonly logger = new Logger(LiaIntakeReactiveService.name);

  constructor(
    private readonly intake: LiaIntakeService,
    private readonly llmFirst: LiaLlmFirstComprehensionService,
  ) {}

  async processTenantReply(params: {
    state: LiaIntakeState;
    message: string;
    title: string;
    description: string;
    tenantFirstName?: string;
  }): Promise<IntakeReactiveTurn> {
    const msg = params.message.trim();
    if (!msg) {
      return {
        state: params.state,
        acknowledgment: null,
        nextQuestionText: null,
      };
    }

    const mode = params.state.intakeMode ?? 'llm_first';
    if (mode === 'llm_first') {
      return this.processLlmFirst(params, msg);
    }

    this.logger.warn(
      `Intake mode « ${mode} » : basculez vers llm_first. Traitement minimal.`,
    );
    return this.processLlmFirst(params, msg);
  }

  private async processLlmFirst(
    params: {
      state: LiaIntakeState;
      message: string;
      title: string;
      description: string;
      tenantFirstName?: string;
    },
    msg: string,
  ): Promise<IntakeReactiveTurn> {
    if (
      isSkipPhotoIntent(msg) &&
      (params.state.phase === 'AWAITING_PHOTO' ||
        params.state.phase === 'INTAKE')
    ) {
      const done = this.intake.markDone({
        ...params.state,
        intakeMode: 'llm_first',
        answers: {
          ...params.state.answers,
          photo_unavailable: msg,
          llm_intake_complete: 'oui',
        },
      });
      const lang = done.preferredLanguage === 'gcf' ? 'gcf' : 'fr';
      return {
        state: done,
        acknowledgment:
          'C’est noté — je lance l’analyse avec votre description, sans photo.',
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
        intakeMode: 'llm_first',
        preferredLanguage: language,
        answers: {
          ...params.state.answers,
          [INTAKE_LANGUAGE_ANSWER_ID]: msg,
        },
      };
      const turn = await this.llmFirst.comprehendTenantTurn({
        state,
        message: msg,
        title: params.title,
        description: params.description,
        tenantFirstName: params.tenantFirstName,
      });
      return this.toReactiveTurn(turn);
    }

    let state: LiaIntakeState = {
      ...params.state,
      intakeMode: 'llm_first',
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

    const turn = await this.llmFirst.comprehendTenantTurn({
      state,
      message: msg,
      title: params.title,
      description: params.description,
      tenantFirstName: params.tenantFirstName,
    });

    if (intent === 'reassurance' || intent === 'meta_question') {
      const reassurance = buildJarvisReassurance({
        message: msg,
        state: turn.state,
        tenantFirstName: params.tenantFirstName,
      });
      return this.toReactiveTurn({
        ...turn,
        acknowledgment: reassurance,
      });
    }

    return this.toReactiveTurn(turn);
  }

  private toReactiveTurn(
    turn: import('../../comprehension/lia-llm-first.types').LlmFirstComprehensionResult,
  ): IntakeReactiveTurn {
    let state = turn.state;
    if (state.phase === 'DONE' && !turn.uiStatus) {
      const lang = state.preferredLanguage === 'gcf' ? 'gcf' : 'fr';
      return {
        state,
        acknowledgment: turn.acknowledgment,
        nextQuestionText: turn.nextQuestion,
        uiStatus: analyzingStatus(lang),
      };
    }
    return {
      state,
      acknowledgment: turn.acknowledgment,
      nextQuestionText: turn.nextQuestion,
      uiStatus: turn.uiStatus,
    };
  }
}
