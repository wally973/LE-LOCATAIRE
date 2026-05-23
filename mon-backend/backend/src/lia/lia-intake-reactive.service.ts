import { Injectable, Logger } from '@nestjs/common';
import { LiaHostService } from './lia-host.service';
import {
  INTAKE_QUESTIONS,
  type IntakeCategory,
  type IntakeReactiveTurn,
  type LiaIntakeState,
  LiaIntakeService,
} from './lia-intake.service';

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

    const llm = await this.tryLlmAnalysis(state, msg, params.title, params.description);
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
      const lighting = this.intake.isLightingOnlyScope(
        full,
        signals,
        answers,
      );

      if (lighting) {
        answers.scope =
          answers.scope ??
          'Éclairage localisé (point lumineux, pas coupure générale).';
        skipped.add('breaker');
        skipped.add('breaker_stays');
        skipped.add('subscription');
      }

      if (/ampoule/.test(t) && /chang|remplac|essay|neuf|m[eê]me/.test(t)) {
        answers.bulb_action = message.trim();
        if (lighting) {
          skipped.add('breaker');
          skipped.add('breaker_stays');
        }
      }

      if (
        /(lumi[eè]re|[eé]clairage|ampoule|plafonnier)/.test(t) &&
        /(quel appareil|pas disjoncteur|pas le disjoncteur|je vous parle)/.test(
          t,
        )
      ) {
        skipped.add('breaker');
        skipped.add('breaker_stays');
        skipped.add('subscription');
        answers.clarification = message.trim();
      }

      if (
        /(disjoncteur|compteur|tableau)/.test(t) &&
        /(essay|d[eé]j[aà]|oui|non)/.test(t)
      ) {
        answers.breaker = message.trim();
      }
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
      const q = INTAKE_QUESTIONS[state.category].find((x) => x.id === 'since_when');
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
    if (state.category !== 'ELECTRICITY') {
      if (this.looksLikeSinceWhen(message)) {
        return 'Merci, c’est noté pour la durée du problème.';
      }
      return null;
    }

    if (/(quel appareil|je vous parle de la lumi)/.test(t)) {
      const room = state.signals?.roomHint ?? 'cet éclairage';
      return (
        `D’accord, je comprends : il s’agit bien de la lumière (${room}), ` +
        `pas d’une coupure électrique générale. Je n’insiste pas sur le disjoncteur.`
      );
    }
    if (/ampoule/.test(t) && /chang|remplac|essay/.test(t)) {
      return (
        'Merci : vous avez déjà changé l’ampoule. ' +
        'Je note ce point avant la suite.'
      );
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
    const list = INTAKE_QUESTIONS[state.category];
    const system = [
      'Tu es Lia, assistante logement. JSON uniquement.',
      'Analyse la réponse du locataire pour l’intake (questions de qualification).',
      'Ne pose pas de question déjà couverte par la réponse.',
      'Si le locataire parle d’une ampoule / lumière d’une pièce, ne demande pas le disjoncteur général.',
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
