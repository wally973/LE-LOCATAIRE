import { Injectable } from '@nestjs/common';
import {
  LiaIntakeService,
  type IntakeReactiveTurn,
  type LiaIntakeState,
} from '../intake/lia-intake.service';
import { LiaIntakeReactiveService } from '../intake/lia-intake-reactive.service';
import { LiaConversationService } from './lia-conversation.service';
import { LiaExpertPocketService } from './lia-expert-pocket.service';
import { LiaLlmFirstComprehensionService } from '../../comprehension/lia-llm-first-comprehension.service';
import { categoryLabel } from '../../chercheur/knowledge/lia-multi-claim';
import { isConfirmedTopicChange } from '../intake/lia-jarvis-intake.engine';

/**
 * Capacité « compréhension » — intake, cadrage, multi-sujet (40 jours de logique métier).
 * Ne tranche pas la responsabilité juridique.
 */
@Injectable()
export class LiaComprehensionService {
  constructor(
    private readonly intake: LiaIntakeService,
    private readonly intakeReactive: LiaIntakeReactiveService,
    private readonly conversation: LiaConversationService,
    private readonly expertPocket: LiaExpertPocketService,
    private readonly llmFirst: LiaLlmFirstComprehensionService,
  ) {}

  createInitialIntake(title: string, description: string): LiaIntakeState {
    return this.intake.createInitialState(title, description);
  }

  skipIntake(
    title: string,
    description: string,
    requirePhoto: boolean,
  ): LiaIntakeState {
    return this.intake.skipConversationIntake(title, description, requirePhoto);
  }

  situationAnalysisLines(
    firstName: string,
    title: string,
    description: string,
    state: LiaIntakeState,
  ): string[] {
    return this.intake.buildSituationAnalysisMessages(
      firstName,
      title,
      description,
      state,
    );
  }

  async appendSituationAnalysis(
    ticketId: number,
    firstName: string,
    title: string,
    description: string,
    state: LiaIntakeState,
  ): Promise<LiaIntakeState> {
    if (state.answers.situation_analysis_sent === 'oui') {
      return state;
    }
    const lines = this.situationAnalysisLines(
      firstName,
      title,
      description,
      state,
    );
    if ((state.intakeMode ?? 'llm_first') === 'llm_first') {
      const turn = await this.llmFirst.comprehendOpening({
        state,
        title,
        description,
        tenantFirstName: firstName,
      });
      const locale =
        turn.state.preferredLanguage === 'gcf' ? 'gcf-GP' : 'fr-FR';
      await this.conversation.appendMessage(
        ticketId,
        'LIA_HOST',
        turn.acknowledgment,
        locale,
        { uiStatus: turn.uiStatus },
      );
      if (turn.nextQuestion) {
        await this.conversation.appendMessage(
          ticketId,
          'LIA_HOST',
          turn.nextQuestion,
          locale,
        );
      }
      return {
        ...turn.state,
        answers: {
          ...turn.state.answers,
          situation_analysis_sent: 'oui',
        },
      };
    }

    const opening = this.expertPocket.buildOpeningAck({
      tenantFirstName: firstName,
      title,
      description,
      state,
    });
    if (opening) {
      await this.conversation.appendMessage(
        ticketId,
        'LIA_HOST',
        opening.text,
        opening.language === 'gcf' ? 'gcf-GP' : 'fr-FR',
        { uiStatus: opening.uiStatus },
      );
      return {
        ...state,
        answers: { ...state.answers, situation_analysis_sent: 'oui' },
      };
    }
    if (lines.length === 0) {
      return {
        ...state,
        answers: { ...state.answers, situation_analysis_sent: 'oui' },
      };
    }
    await this.conversation.appendMessage(
      ticketId,
      'LIA_HOST',
      lines.join('\n\n'),
    );
    return {
      ...state,
      answers: { ...state.answers, situation_analysis_sent: 'oui' },
    };
  }

  recordAnswer(state: LiaIntakeState, answer: string): LiaIntakeState {
    return this.intake.recordAnswer(state, answer);
  }

  /** Intake réactif : analyse la réponse avant la prochaine question. */
  processTenantReply(params: {
    state: LiaIntakeState;
    message: string;
    title: string;
    description: string;
    tenantFirstName?: string;
  }): Promise<IntakeReactiveTurn> {
    return this.intakeReactive.processTenantReply(params);
  }

  currentQuestion(state: LiaIntakeState) {
    return this.intake.getCurrentQuestion(state);
  }

  photoRequestText(state: LiaIntakeState): string {
    return this.intake.photoRequestMessage(state);
  }

  markDone(state: LiaIntakeState): LiaIntakeState {
    return this.intake.markDone(state);
  }

  skipPhotoAck(): string {
    return this.intake.skipPhotoAck();
  }

  isWrongTopicMessage(
    message: string,
    title: string,
    description: string,
    intake: LiaIntakeState | null,
  ): boolean {
    if (!intake) return false;
    if (intake.topicChangePending && intake.answers.topic_change_confirmed === 'oui') {
      return true;
    }
    return isConfirmedTopicChange(
      message,
      title,
      description,
      intake.category,
    );
  }

  wrongTopicReply(intake: LiaIntakeState | null): string {
    const label = intake ? categoryLabel(intake.category) : 'ce dossier';
    return (
      `Ce message concerne un autre sujet que ${label}. ` +
      'Pour ne pas mélanger les diagnostics, ouvrez une nouvelle demande depuis l’accueil ' +
      '(bouton « Déclarer un problème »). Chaque réclamation (WC, électricité, etc.) a son propre numéro d’affaire.'
    );
  }

  closedDossierReply(): string {
    return (
      'Ce dossier est terminé. Pour un autre problème, retournez à l’accueil ' +
      'et ouvrez une nouvelle demande.'
    );
  }
}
