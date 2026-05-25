import { Injectable, Logger } from '@nestjs/common';
import { LiaHostService } from '../conversation/lia-host.service';
import {
  getIntakeQuestionsForState,
  isLightingOnlyScope,
  tenantAlreadyChangedBulb,
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
  buildMarieElectricityAcknowledgment,
  isElectricityLightingIntakeSaturated,
} from './lia-intake-electricity-extract';
import {
  applyJarvis360ToState,
  buildJarvisReassurance,
  buildTopicChangeConfirmationQuestion,
  detectJarvisDialogueIntent,
  detectedTopicLabelForConfirmation,
  isJarvisReadyForImmediateVerdict,
  parseTopicChangeConfirmation,
} from './lia-jarvis-intake.engine';
import { categoryLabel } from '../../chercheur/knowledge/lia-multi-claim';

/**
 * Intake réactif mode Jarvis — extraction 360°, dialogue naturel, questions critiques uniquement.
 */
@Injectable()
export class LiaIntakeReactiveService {
  private readonly logger = new Logger(LiaIntakeReactiveService.name);

  constructor(
    private readonly intake: LiaIntakeService,
    private readonly host: LiaHostService,
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

    if (
      params.state.phase === 'AWAITING_PHOTO' &&
      isSkipPhotoIntent(msg)
    ) {
      const done = this.intake.markDone({
        ...params.state,
        answers: {
          ...params.state.answers,
          photo_unavailable: msg,
        },
      });
      return {
        state: done,
        acknowledgment:
          'Pas de souci : votre téléphone ne permet pas d’envoyer de photo. ' +
          'Je lance l’analyse avec votre description et vos réponses.',
        nextQuestionText: null,
      };
    }

    if (isTenantLanguageGreeting(msg) && !params.state.answers[INTAKE_LANGUAGE_ANSWER_ID]) {
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
      state = this.intake.reconcileStepIndex(state);
      const next = this.intake.getCurrentQuestion(state);
      return {
        state,
        acknowledgment:
          language === 'gcf'
            ? 'Bonjou ! Mo ka koz ar ou an kréyòl. Di mwen kisa ki rive — mo pral poze kèk kesyon si mo manke yon bagay enpòtan.'
            : 'Bonjour ! Je vous réponds en français. Décrivez ce qui se passe ; je ne vous poserai une question que si une information critique manque.',
        nextQuestionText: state.phase === 'INTAKE' && next ? next.text : null,
      };
    }

    let state: LiaIntakeState = {
      ...params.state,
      intakeMode: params.state.intakeMode ?? 'jarvis',
    };

    if (state.topicChangePending) {
      const decision = parseTopicChangeConfirmation(msg);
      if (decision === 'yes') {
        state = {
          ...state,
          answers: { ...state.answers, topic_change_confirmed: 'oui' },
        };
        return {
          state,
          acknowledgment:
            'Très bien. Pour ce second sujet, ouvrez une nouvelle demande depuis l’accueil ' +
            '(bouton « Déclarer un problème »). Je clos la suite de ce fil pour éviter de mélanger les diagnostics.',
          nextQuestionText: null,
        };
      }
      if (decision === 'no') {
        state = {
          ...state,
          topicChangePending: false,
          pendingTopicLabel: undefined,
        };
        state = applyJarvis360ToState(
          state,
          params.title,
          params.description,
          msg,
        );
        state = this.intake.reconcileStepIndex(state);
        const next = this.intake.getCurrentQuestion(state);
        return {
          state,
          acknowledgment: buildJarvisReassurance({
            message: msg,
            state,
            tenantFirstName: params.tenantFirstName,
          }),
          nextQuestionText:
            state.phase === 'INTAKE' && next
              ? this.intake.questionText(state, next)
              : null,
        };
      }
    }

    state = applyJarvis360ToState(
      state,
      params.title,
      params.description,
      msg,
    );

    const intent = detectJarvisDialogueIntent(
      msg,
      params.title,
      params.description,
    );

    let acknowledgment: string | null = null;

    if (intent === 'reassurance' || intent === 'meta_question') {
      acknowledgment = buildJarvisReassurance({
        message: msg,
        state,
        tenantFirstName: params.tenantFirstName,
      });
    } else if (intent === 'topic_change_candidate') {
      const label =
        detectedTopicLabelForConfirmation(msg, state.category) ??
        'un autre sujet';
      state = {
        ...state,
        topicChangePending: true,
        pendingTopicLabel: label,
      };
      acknowledgment = buildJarvisReassurance({
        message: msg,
        state,
        tenantFirstName: params.tenantFirstName,
      });
      const confirmQ = buildTopicChangeConfirmationQuestion(label);
      return {
        state,
        acknowledgment,
        nextQuestionText: confirmQ,
      };
    }

    const pending = this.intake.getCurrentQuestion(state);
    if (pending && !state.answers[pending.id]?.trim()) {
      state = this.intake.recordAnswer(state, msg);
      state = applyJarvis360ToState(
        state,
        params.title,
        params.description,
        msg,
      );
    }

    state = this.intake.reconcileStepIndex(state);

    const llm =
      state.intakeMode === 'legacy' || state.organizer
        ? null
        : await this.tryLlmAnalysis(
            state,
            msg,
            params.title,
            params.description,
          );
    if (llm) {
      state = llm.state;
      state = this.intake.reconcileStepIndex(state);
    }

    if (!acknowledgment) {
      acknowledgment =
        llm?.acknowledgment ??
        this.buildJarvisAcknowledgment(state, msg, params.tenantFirstName);
    }

    if (
      state.category === 'ELECTRICITY' &&
      (state.phase === 'DONE' || isElectricityLightingIntakeSaturated(state))
    ) {
      acknowledgment = buildMarieElectricityAcknowledgment({
        title: params.title,
        description: params.description,
        answers: state.answers,
        tenantFirstName: params.tenantFirstName,
      });
    }

    if (
      isJarvisReadyForImmediateVerdict(state) &&
      state.phase === 'DONE' &&
      !acknowledgment
    ) {
      const label = categoryLabel(state.category);
      acknowledgment =
        `${params.tenantFirstName?.trim() || 'Merci'} — j’ai assez d’éléments sur votre ${label.toLowerCase()} pour lancer l’analyse tout de suite.`;
    }

    const next = this.intake.getCurrentQuestion(state);
    let nextQuestionText: string | null = null;
    if (state.phase === 'INTAKE' && next) {
      nextQuestionText = this.intake.questionText(state, next);
    } else if (state.phase === 'AWAITING_PHOTO') {
      nextQuestionText = this.intake.photoRequestMessage(state);
    }

    return { state, acknowledgment, nextQuestionText };
  }

  private buildJarvisAcknowledgment(
    state: LiaIntakeState,
    message: string,
    tenantFirstName?: string,
  ): string | null {
    if (
      state.category === 'ELECTRICITY' &&
      isElectricityLightingIntakeSaturated(state)
    ) {
      return buildMarieElectricityAcknowledgment({
        title: state.intakeTitle ?? '',
        description: state.intakeDescription ?? '',
        answers: state.answers,
        tenantFirstName,
      });
    }

    const facts = Object.keys(state.jarvisFacts ?? {});
    if (facts.length > 0 && state.phase === 'DONE') {
      return (
        `${tenantFirstName?.trim() || 'Merci'} — j’ai bien noté ` +
        `${facts.slice(0, 3).join(', ')}. Je lance l’analyse.`
      );
    }

    if (state.jarvisFacts?.nouveau_locataire && state.jarvisFacts?.localisation) {
      return (
        'C’est noté : nouveau locataire et problème sous l’évier. ' +
        'Je ne vous ferai pas répéter ce que vous avez déjà précisé.'
      );
    }

    const t = message.toLowerCase();
    if (tenantAlreadyChangedBulb(`${message} ${Object.values(state.answers).join(' ')}`, state.answers)) {
      return 'Ampoule déjà changée : je ne vous le redemanderai pas.';
    }
    if (/depuis|semaine|hier|jour|mois/.test(t)) {
      return 'Merci, c’est noté.';
    }
    if (state.organizer || state.intakeMode === 'jarvis') {
      return 'Merci pour cette précision — je l’intègre au diagnostic.';
    }
    return null;
  }

  private async tryLlmAnalysis(
    state: LiaIntakeState,
    message: string,
    title: string,
    description: string,
  ): Promise<{ state: LiaIntakeState; acknowledgment: string } | null> {
    const list = getIntakeQuestionsForState(state);
    const system = [
      'Tu es Lia, technicienne logement autonome. JSON uniquement.',
      'Le fichier panne-diagnostic est une BASE DE CONNAISSANCES, pas un script à suivre dans l’ordre.',
      'Extraction 360° : tout ce que le locataire dit est acquis ; ne redemande jamais.',
      'Pose une question UNIQUEMENT si une info CRITIQUE manque pour le diagnostic.',
      'Si contestation ou colère, réassure (pas de changement de sujet automatique).',
      'Format JSON :',
      '{ "acknowledgment": "...", "newAnswers": {}, "skipQuestionIds": [], "intakeComplete": false }',
    ].join('\n');

    const user = JSON.stringify({
      category: state.category,
      title,
      description,
      jarvisFacts: state.jarvisFacts ?? {},
      currentAnswers: state.answers,
      tenantMessage: message.slice(0, 600),
      questions: list.map((q) => ({ id: q.id, text: q.text })),
    });

    const raw = await this.host.chatStructured(system, user, 400);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as {
        acknowledgment?: string;
        newAnswers?: Record<string, string>;
        skipQuestionIds?: string[];
        intakeComplete?: boolean;
      };
      const answers = { ...state.answers, ...parsed.newAnswers };
      const skipped = new Set([
        ...(state.skippedQuestionIds ?? []),
        ...(parsed.skipQuestionIds ?? []),
      ]);
      let next: LiaIntakeState = { ...state, answers, skippedQuestionIds: [...skipped] };
      if (parsed.intakeComplete) {
        next = {
          ...next,
          phase: this.intake.needsPhoto(next) ? 'AWAITING_PHOTO' : 'DONE',
        };
      }
      const ack = parsed.acknowledgment?.trim();
      if (!ack) return null;
      return { state: next, acknowledgment: ack };
    } catch (e) {
      this.logger.warn('Intake Jarvis JSON invalide', e);
      return null;
    }
  }
}
