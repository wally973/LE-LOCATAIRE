import { Injectable, Logger } from '@nestjs/common';
import { LiaHostService } from '../conversation/lia-host.service';
import type { LiaMessageUiStatus } from '../conversation/lia-message-ui-status';
import { analyzingStatus, landlordHandoffStatus } from '../conversation/lia-message-ui-status';
import {
  LiaIntakeService,
  type LiaIntakeState,
} from './lia-intake.service';
import {
  applyJarvis360ToState,
  buildJarvisReassurance,
  detectJarvisDialogueIntent,
  ensureJarvisOrganizer,
  isJarvisReadyForImmediateVerdict,
  pickJarvisCriticalQuestion,
} from './lia-jarvis-intake.engine';
import {
  jarvisSystemPromptPrefix,
  JARVIS_HANDOFF_TENANT_MESSAGE_FR,
} from './lia-jarvis-visual-logic';
import { LiaJarvisHandoffService } from './lia-jarvis-handoff.service';
import {
  buildJarvisDialogueContext,
  detectJarvisPhysicalContradiction,
} from './lia-jarvis-reasoning';

export interface JarvisPilotTurn {
  state: LiaIntakeState;
  acknowledgment: string;
  nextQuestion: string | null;
  uiStatus?: LiaMessageUiStatus;
  fromLlm: boolean;
  handoffTriggered?: boolean;
}

interface JarvisLlmPayload {
  language?: 'fr' | 'gcf';
  acknowledgment: string;
  nextQuestion?: string | null;
  intakeComplete?: boolean;
  acquiredFacts?: Record<string, string>;
  visualizationNote?: string;
  handoffRequired?: boolean;
  handoffReason?: string;
}

const JARVIS_JSON_SYSTEM = [
  jarvisSystemPromptPrefix(),
  '',
  'Réponds en JSON uniquement :',
  '{',
  '  "language": "fr" | "gcf",',
  '  "acknowledgment": "2 à 4 phrases",',
  '  "nextQuestion": null ou une question critique unique",',
  '  "intakeComplete": boolean,',
  '  "acquiredFacts": { "cle": "valeur" },',
  '  "visualizationNote": "quelle analogie (dalle/vases/enveloppe) et flux simulés",',
  '  "handoffRequired": boolean,',
  '  "handoffReason": "si handoffRequired"',
  '}',
].join('\n');

@Injectable()
export class LiaJarvisPilotService {
  private readonly logger = new Logger(LiaJarvisPilotService.name);

  constructor(
    private readonly host: LiaHostService,
    private readonly intake: LiaIntakeService,
    private readonly handoff: LiaJarvisHandoffService,
  ) {}

  /** État initial Jarvis (organisateur KB + extraction 360°). */
  bootstrapState(title: string, description: string): LiaIntakeState {
    let state = this.intake.createInitialState(title, description);
    state = ensureJarvisOrganizer(
      { ...state, intakeMode: 'jarvis' },
      title,
      description,
    );
    state = applyJarvis360ToState(state, title, description);
    state = {
      ...state,
      skippedQuestionIds: [
        ...new Set([
          ...(state.skippedQuestionIds ?? []),
          ...this.intake.allScriptQuestionIds(state.category),
        ]),
      ],
    };
    return this.intake.reconcileStepIndex(state);
  }

  async runOpening(params: {
    state: LiaIntakeState;
    title: string;
    description: string;
    tenantFirstName?: string;
    ticketId?: number;
  }): Promise<JarvisPilotTurn> {
    let state = applyJarvis360ToState(
      params.state,
      params.title,
      params.description,
    );
    const intentTurn = await this.runLlmTurn({
      mode: 'opening',
      state,
      title: params.title,
      description: params.description,
      message: '',
      tenantFirstName: params.tenantFirstName,
    });
    if (intentTurn.handoffTriggered && params.ticketId) {
      await this.handoff.dispatchSectorTechnician({
        ticketId: params.ticketId,
        intake: intentTurn.state,
        reason: intentTurn.state.jarvisFacts?.handoff_reason ?? 'Situation complexe',
        visualizationNote: intentTurn.state.jarvisFacts?.visualization,
      });
    }
    return intentTurn;
  }

  async runTenantTurn(params: {
    state: LiaIntakeState;
    message: string;
    title: string;
    description: string;
    tenantFirstName?: string;
    ticketId?: number;
  }): Promise<JarvisPilotTurn> {
    let state = applyJarvis360ToState(
      params.state,
      params.title,
      params.description,
      params.message,
    );

    const intent = detectJarvisDialogueIntent(
      params.message,
      params.title,
      params.description,
    );

    if (intent === 'reassurance' || intent === 'meta_question') {
      const reassurance = buildJarvisReassurance({
        message: params.message,
        state,
        tenantFirstName: params.tenantFirstName,
      });
      const lang = state.preferredLanguage === 'gcf' ? 'gcf' : 'fr';
      return {
        state,
        acknowledgment: reassurance,
        nextQuestion: null,
        fromLlm: false,
        uiStatus: analyzingStatus(lang),
      };
    }

    const turn = await this.runLlmTurn({
      mode: 'tenant_turn',
      state,
      title: params.title,
      description: params.description,
      message: params.message,
      tenantFirstName: params.tenantFirstName,
    });

    if (turn.handoffTriggered && params.ticketId) {
      await this.handoff.dispatchSectorTechnician({
        ticketId: params.ticketId,
        intake: turn.state,
        reason:
          turn.state.jarvisFacts?.handoff_reason ??
          'Faits physiques incohérents ou diagnostic bloqué',
        visualizationNote: turn.state.jarvisFacts?.visualization,
      });
    }

    return turn;
  }

  private async runLlmTurn(params: {
    mode: 'opening' | 'tenant_turn';
    state: LiaIntakeState;
    title: string;
    description: string;
    message: string;
    tenantFirstName?: string;
  }): Promise<JarvisPilotTurn> {
    const signalement = `${params.title} ${params.description}`;
    const contradiction = detectJarvisPhysicalContradiction(
      `${signalement} ${params.message}`,
      params.state,
    );
    if (contradiction.contradictory) {
      return this.buildHandoffTurn(params.state, {
        acknowledgment: '',
        handoffRequired: true,
        handoffReason: contradiction.reason,
        language: params.state.preferredLanguage === 'gcf' ? 'gcf' : 'fr',
      });
    }

    const user = JSON.stringify({
      mode: params.mode,
      tenantFirstName: params.tenantFirstName ?? 'Bonjour',
      signalement: { title: params.title, description: params.description },
      messageLocataire: params.message.slice(0, 800),
      category: params.state.category,
      jarvisFacts: params.state.jarvisFacts ?? {},
      answers: params.state.answers,
      organizerPanneId: params.state.organizer?.panneId ?? null,
      contexteVisuel: buildJarvisDialogueContext(params.state, signalement).slice(
        0,
        2000,
      ),
    });

    const raw = await this.host.chatStructured(JARVIS_JSON_SYSTEM, user, 560);
    if (!raw) {
      return this.fallbackTurn(params);
    }

    try {
      const parsed = JSON.parse(raw) as JarvisLlmPayload;
      if (!parsed.acknowledgment?.trim()) {
        return this.fallbackTurn(params);
      }

      if (parsed.handoffRequired) {
        return this.buildHandoffTurn(params.state, parsed);
      }

      return this.applyLlmPayload(params.state, parsed, params.title, params.description);
    } catch (e) {
      this.logger.warn('Jarvis JSON invalide', e);
      return this.fallbackTurn(params);
    }
  }

  private applyLlmPayload(
    state: LiaIntakeState,
    parsed: JarvisLlmPayload,
    title: string,
    description: string,
  ): JarvisPilotTurn {
    const lang = parsed.language === 'gcf' ? 'gcf' : 'fr';
    const facts = {
      ...(state.jarvisFacts ?? {}),
      ...(parsed.acquiredFacts ?? {}),
    };
    if (parsed.visualizationNote) {
      facts.visualization = parsed.visualizationNote;
    }

    let next: LiaIntakeState = {
      ...state,
      intakeMode: 'jarvis',
      preferredLanguage: lang,
      jarvisFacts: facts,
      answers: {
        ...state.answers,
        jarvis_summary: parsed.acknowledgment.slice(0, 500),
        ...Object.fromEntries(
          Object.entries(parsed.acquiredFacts ?? {}).map(([k, v]) => [
            `fact_${k}`,
            v,
          ]),
        ),
      },
      skippedQuestionIds: [
        ...new Set([
          ...(state.skippedQuestionIds ?? []),
          ...this.intake.allScriptQuestionIds(state.category),
        ]),
      ],
    };

    let nextQuestion = parsed.nextQuestion?.trim() || null;
    let intakeComplete =
      parsed.intakeComplete === true || isJarvisReadyForImmediateVerdict(next);

    if (!intakeComplete && !nextQuestion) {
      const critical = pickJarvisCriticalQuestion(next);
      if (critical) {
        nextQuestion = critical.text;
      } else {
        intakeComplete = true;
      }
    }

    if (intakeComplete) {
      next = {
        ...next,
        phase: 'DONE',
        stepIndex: 0,
        answers: { ...next.answers, jarvis_intake_complete: 'oui' },
      };
      nextQuestion = null;
    } else {
      next = { ...next, phase: 'INTAKE' };
    }

    const uiStatus =
      intakeComplete
        ? analyzingStatus(lang)
        : /bailleur|technicien|transmets/i.test(parsed.acknowledgment)
          ? landlordHandoffStatus(lang)
          : undefined;

    return {
      state: next,
      acknowledgment: parsed.acknowledgment.trim(),
      nextQuestion,
      uiStatus,
      fromLlm: true,
    };
  }

  private buildHandoffTurn(
    state: LiaIntakeState,
    parsed: JarvisLlmPayload,
  ): JarvisPilotTurn {
    const lang = parsed.language === 'gcf' ? 'gcf' : 'fr';
    const next: LiaIntakeState = {
      ...state,
      phase: 'DONE',
      intakeMode: 'jarvis',
      jarvisFacts: {
        ...(state.jarvisFacts ?? {}),
        handoff_reason: parsed.handoffReason ?? 'complexité',
        ...(parsed.visualizationNote
          ? { visualization: parsed.visualizationNote }
          : {}),
      },
      answers: {
        ...state.answers,
        jarvis_handoff: 'oui',
      },
    };
    return {
      state: next,
      acknowledgment: JARVIS_HANDOFF_TENANT_MESSAGE_FR,
      nextQuestion: null,
      uiStatus: landlordHandoffStatus(lang),
      fromLlm: true,
      handoffTriggered: true,
    };
  }

  private fallbackTurn(params: {
    state: LiaIntakeState;
    title: string;
    description: string;
    tenantFirstName?: string;
  }): JarvisPilotTurn {
    const name = params.tenantFirstName?.trim() || 'Bonjour';
    const critical = pickJarvisCriticalQuestion(params.state);
    const intakeComplete = !critical && isJarvisReadyForImmediateVerdict(params.state);
    const lang = params.state.preferredLanguage === 'gcf' ? 'gcf' : 'fr';

    let next = params.state;
    if (intakeComplete) {
      next = {
        ...next,
        phase: 'DONE',
        answers: { ...next.answers, jarvis_intake_complete: 'oui' },
      };
    }

    return {
      state: next,
      acknowledgment:
        `${name}, j’ai bien lu votre signalement et je visualise le logement ` +
        '(réseaux d’eau, enveloppe, confort). Je ne vous ferai pas répéter ce que vous avez déjà précisé.',
      nextQuestion: critical?.text ?? null,
      fromLlm: false,
      uiStatus: intakeComplete ? analyzingStatus(lang) : undefined,
    };
  }
}
