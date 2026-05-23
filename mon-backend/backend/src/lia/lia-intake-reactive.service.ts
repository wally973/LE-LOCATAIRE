import { Injectable, Logger } from '@nestjs/common';
import { LiaHostService } from './lia-host.service';
import {
  getIntakeQuestionsForState,
  isLightingOnlyScope,
  tenantAlreadyChangedBulb,
  type IntakeReactiveTurn,
  type LiaIntakeState,
  LiaIntakeService,
} from './lia-intake.service';
import { syncOrganizerFromContext } from './lia-intake-organizer';

/**
 * Intake réactif — analyse chaque réponse locataire avant la question suivante.
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

    let state = this.intake.recordAnswer(params.state, msg);
    state = this.applyRuleBasedAnalysis(state, msg, params.title, params.description);
    state = syncOrganizerFromContext(
      state,
      params.title,
      params.description,
    );

    const llm = state.organizer
      ? null
      : await this.tryLlmAnalysis(state, msg, params.title, params.description);
    if (llm) {
      state = llm.state;
    }

    state = this.intake.reconcileStepIndex(state);

    const acknowledgment =
      llm?.acknowledgment ?? this.buildRuleAcknowledgment(state, msg);

    const next = this.intake.getCurrentQuestion(state);
    let nextQuestionText: string | null = null;
    if (state.phase === 'INTAKE' && next) {
      nextQuestionText = next.text;
    } else if (state.phase === 'AWAITING_PHOTO') {
      nextQuestionText = this.intake.photoRequestMessage(state);
    }

    return { state, acknowledgment, nextQuestionText };
  }

  /** Règles métier rapides (sans LLM). */
  private applyRuleBasedAnalysis(
    state: LiaIntakeState,
    message: string,
    title: string,
    description: string,
  ): LiaIntakeState {
    const t = message.toLowerCase();
    const full = `${title} ${description} ${message}`;
    const answers = { ...state.answers };
    const skipped = new Set(state.skippedQuestionIds ?? []);
    let signals = { ...state.signals };

    const room = this.intake.extractSignals(message).roomHint;
    if (room) {
      signals = { ...signals, roomHint: room };
    }

    if (state.category === 'ELECTRICITY') {
      const lighting = isLightingOnlyScope(full, signals, answers);

      if (lighting) {
        answers.scope =
          answers.scope ??
          'Éclairage localisé (point lumineux, pas coupure générale).';
        skipped.add('breaker');
        skipped.add('breaker_stays');
        skipped.add('subscription');
      }

      if (tenantAlreadyChangedBulb(full, answers)) {
        answers.bulb_action =
          answers.bulb_action ??
          'Ampoule déjà remplacée — ne pas redemander ce geste.';
      } else if (
        /ampoule/.test(t) &&
        /chang|remplac|essay|neuf|m[eê]me|malgr/.test(t)
      ) {
        answers.bulb_action = message.trim();
      }

      if (
        /(interrupteur|marche|arr[eê]t)/.test(t) &&
        /(essay|fonction|oui|non|marche)/.test(t)
      ) {
        answers.switch_ok = message.trim();
      }
      if (/(disjoncteur|tableau)/.test(t) && /(essay|enclench|remis|oui|non)/.test(t)) {
        answers.room_breaker = message.trim();
      }
      if (/(douille|support|culot)/.test(t)) {
        answers.socket_check = message.trim();
      }

      if (
        /(lumi[eè]re|[eé]clairage|ampoule|plafonnier)/.test(t) &&
        /(quel appareil|pas disjoncteur|je vous parle)/.test(t)
      ) {
        answers.clarification = message.trim();
      }
    }

    if (
      /moisissure|humidit|moisi|condensation/.test(t) &&
      /bricol|essay|trait|javel|peinture|deshumidificateur|déshumidificateur|aere|aéré/.test(
        t,
      )
    ) {
      answers.bricolage_attempts = message.trim();
    }

    if (state.category === 'PLUMBING') {
      if (/siphon|d[eé]bouch|produit|visser/.test(t)) {
        answers.siphon_action = message.trim();
      }
      if (/(lavabo|[eé]vier|wc).*(ok|coule|normal)/.test(t)) {
        answers.drain_ok = message.trim();
      }
    }

    if (!answers.since_when && this.looksLikeSinceWhen(message)) {
      const q = getIntakeQuestionsForState(state).find(
        (x) => x.id === 'since_when',
      );
      if (q && !skipped.has('since_when')) {
        answers.since_when = message.trim();
      }
    }

    return {
      ...state,
      answers,
      signals,
      skippedQuestionIds: [...skipped],
    };
  }

  private looksLikeSinceWhen(message: string): boolean {
    return /depuis|semaine|hier|matin|jour|mois|aujourd|ce matin|cette semaine|\d+\s*(jour|semaine|mois)/i.test(
      message,
    );
  }

  private buildRuleAcknowledgment(
    state: LiaIntakeState,
    message: string,
  ): string | null {
    const t = message.toLowerCase();
    if (state.organizer) {
      if (state.organizer.eliminatedCauseIds.includes('cause_ampoule_usee')) {
        return (
          'Merci — je ne vous redemanderai pas de changer l’ampoule. ' +
          'Je continue le diagnostic avec les autres pistes.'
        );
      }
      if (/depuis|semaine|hier|jour|mois/.test(t)) {
        return 'Merci, c’est noté.';
      }
      return 'Merci pour cette précision, je l’intègre au diagnostic.';
    }
    if (state.category !== 'ELECTRICITY') {
      if (this.looksLikeSinceWhen(message)) {
        return 'Merci, c’est noté pour la durée du problème.';
      }
      return null;
    }

    const bulbDone = tenantAlreadyChangedBulb(
      `${message} ${Object.values(state.answers).join(' ')}`,
      state.answers,
    );

    if (/(quel appareil|je vous parle de la lumi)/.test(t)) {
      const room = state.signals?.roomHint ?? 'cet éclairage';
      return (
        `D’accord : la lumière de ${room}, pas une coupure générale. ` +
        (bulbDone
          ? 'Ampoule déjà changée : nous vérifions interrupteur et alimentation du circuit.'
          : '')
      );
    }
    if (bulbDone && /ampoule/.test(t)) {
      return (
        'C’est bien noté : vous avez déjà changé l’ampoule, je ne vous le redemanderai pas. ' +
        'Je vais orienter vers l’interrupteur, le disjoncteur de la pièce au tableau, puis la douille si besoin.'
      );
    }
    if (bulbDone && !state.answers.switch_ok) {
      return null;
    }
    if (this.looksLikeSinceWhen(message)) {
      return 'Merci, j’ai bien noté depuis quand le problème est apparu.';
    }
    if (state.signals?.roomHint) {
      return `Merci pour la précision sur ${state.signals.roomHint}.`;
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
      'Tu es Lia, assistante logement. JSON uniquement.',
      'Analyse la réponse du locataire pour l’intake (questions de qualification).',
      'Ne pose pas de question déjà couverte par la réponse.',
      'Si le locataire a DÉJÀ changé l’ampoule, ne lui redemande jamais de changer l’ampoule.',
      'Dans ce cas, oriente vers interrupteur de la pièce, disjoncteur du circuit au tableau, état de la douille.',
      'Si le locataire parle d’une ampoule / lumière d’une pièce, ne traite pas comme une coupure générale du logement.',
      'Format JSON :',
      '{',
      '  "acknowledgment": "1-2 phrases bienveillantes en français",',
      '  "newAnswers": { "questionId": "réponse" },',
      '  "skipQuestionIds": ["id"],',
      '  "intakeComplete": false',
      '}',
    ].join('\n');

    const user = JSON.stringify({
      category: state.category,
      title,
      description,
      currentAnswers: state.answers,
      alreadySkipped: state.skippedQuestionIds ?? [],
      questions: list.map((q) => ({ id: q.id, text: q.text })),
      tenantMessage: message.slice(0, 600),
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
      let next = { ...state, answers, skippedQuestionIds: [...skipped] };
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
      this.logger.warn('Intake réactif JSON invalide', e);
      return null;
    }
  }
}
