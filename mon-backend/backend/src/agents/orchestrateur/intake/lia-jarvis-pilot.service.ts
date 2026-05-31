import { Injectable, Logger } from '@nestjs/common';
import { LiaHostService } from '../conversation/lia-host.service';
import type { LiaMessageUiStatus } from '../conversation/lia-message-ui-status';
import {
  analyzingStatus,
  dossierTransmisStatus,
  landlordHandoffStatus,
} from '../conversation/lia-message-ui-status';
import { normalizeCompanionLanguage } from '../../shared/lia-dialogue-languages';
import type { CompanionLanguage } from '../conversation/lia-companion.types';
import {
  LiaIntakeService,
  type LiaIntakeState,
} from './lia-intake.service';
import {
  applyJarvis360ToState,
  buildJarvisReassurance,
  detectJarvisDialogueIntent,
  ensureJarvisOrganizer,
} from './lia-jarvis-intake.engine';
import { JARVIS_HANDOFF_TENANT_MESSAGE_FR } from './lia-jarvis-visual-logic';
import { LiaJarvisHandoffService } from './lia-jarvis-handoff.service';
import { isJarvisLlmBridgeEnabled } from './lia-jarvis-bridge.config';
import {
  LiaJarvisLlmBridgeService,
  type JarvisLlmBridgeResult,
} from './lia-jarvis-llm-bridge';
import { detectJarvisPhysicalContradiction } from './lia-jarvis-reasoning';
import {
  appendJarvisIntakeTransmission,
} from './lia-jarvis-dialogue.i18n';
import {
  pickCouncilSpokenQuestion,
  runCouncilRound,
  serializeCouncilRound,
  parseCouncilRound,
} from './lia-jarvis-council.engine';
import { synthesizeJarvisFromCouncil } from './lia-jarvis-voice-synthesis';
import type { CouncilRound } from './lia-jarvis-council.types';
import { inferHousingPerspective } from './lia-housing-perspective';
import {
  attachSimulationToState,
  buildJarvisConsultation,
  isSimulationIntakeComplete,
  parseSimulationFromState,
  runJarvisSimulation,
  syncJarvisSimulationOnState,
} from './lia-jarvis-simulation.engine';
import { pickChainQuestion } from './lia-jarvis-visual-chain';

export interface JarvisPilotTurn {
  state: LiaIntakeState;
  acknowledgment: string;
  nextQuestion: string | null;
  uiStatus?: LiaMessageUiStatus;
  fromLlm: boolean;
  handoffTriggered?: boolean;
  /** Murmures du conseil (console expert / Lia-Lab) */
  councilRound?: CouncilRound;
}

interface JarvisLlmPayload {
  language?: CompanionLanguage;
  acknowledgment: string;
  nextQuestion?: string | null;
  intakeComplete?: boolean;
  acquiredFacts?: Record<string, string>;
  visualizationNote?: string;
  handoffRequired?: boolean;
  handoffReason?: string;
}

const JARVIS_POLISH_SYSTEM = [
  'Tu es Lia — Agent Jarvis. Reformule UNIQUEMENT le ton dans la langue indiquée (fr ou gcf).',
  'Ne change PAS les faits, la visualisation physique ni la question discriminante.',
  'Réponds en JSON : { "acknowledgment": "...", "nextQuestion": "..." | null }',
].join('\n');

@Injectable()
export class LiaJarvisPilotService {
  private readonly logger = new Logger(LiaJarvisPilotService.name);

  constructor(
    private readonly host: LiaHostService,
    private readonly intake: LiaIntakeService,
    private readonly handoff: LiaJarvisHandoffService,
    private readonly llmBridge: LiaJarvisLlmBridgeService,
  ) {}

  bootstrapState(
    title: string,
    description: string,
    preferredLanguage = 'fr',
    residenceUnitNumber?: string,
  ): LiaIntakeState {
    const lang = preferredLanguage.trim() || 'fr';
    const housing = inferHousingPerspective(residenceUnitNumber);
    let state = this.intake.createInitialState(title, description);
    state = {
      ...state,
      intakeMode: 'jarvis',
      preferredLanguage: lang,
      answers: { ...state.answers, language_preference: lang },
      jarvisFacts: {
        ...(state.jarvisFacts ?? {}),
        langue_choisie: 'oui',
        housing_unit: residenceUnitNumber?.trim() ?? '',
        housing_kind: housing.kind,
        housing_visual: housing.visualNote,
      },
    };
    state = ensureJarvisOrganizer(state, title, description);
    state = applyJarvis360ToState(state, title, description);
    if (!isJarvisLlmBridgeEnabled()) {
      state = syncJarvisSimulationOnState(state, title, description);
    }
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
    residenceUnitNumber?: string;
  }): Promise<JarvisPilotTurn> {
    let state = applyJarvis360ToState(
      params.state,
      params.title,
      params.description,
    );
    if (!isJarvisLlmBridgeEnabled()) {
      state = syncJarvisSimulationOnState(state, params.title, params.description);
    }

    const turn = await this.runSimulationConsultation({
      mode: 'opening',
      state,
      title: params.title,
      description: params.description,
      message: '',
      tenantFirstName: params.tenantFirstName,
      residenceUnitNumber: params.residenceUnitNumber,
    });

    if (turn.handoffTriggered && params.ticketId) {
      await this.handoff.dispatchSectorTechnician({
        ticketId: params.ticketId,
        intake: turn.state,
        reason: turn.state.jarvisFacts?.handoff_reason ?? 'Situation complexe',
        visualizationNote: turn.state.jarvisFacts?.visualization,
      });
    }
    return turn;
  }

  async runTenantTurn(params: {
    state: LiaIntakeState;
    message: string;
    title: string;
    description: string;
    tenantFirstName?: string;
    ticketId?: number;
    residenceUnitNumber?: string;
  }): Promise<JarvisPilotTurn> {
    const wasAlreadyComplete = this.isIntakeAlreadyComplete(params.state);

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

    if (wasAlreadyComplete) {
      const turn = await this.runSimulationConsultation({
        mode: 'tenant_turn',
        state,
        title: params.title,
        description: params.description,
        message: params.message,
        tenantFirstName: params.tenantFirstName,
        wasAlreadyComplete: true,
        lastAcknowledgment: params.state.answers.jarvis_last_ack,
        residenceUnitNumber: params.residenceUnitNumber,
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

    if (intent === 'reassurance' || intent === 'meta_question') {
      const reassurance = buildJarvisReassurance({
        message: params.message,
        state,
        tenantFirstName: params.tenantFirstName,
      });
      const sim = parseSimulationFromState(state);
      const lang = sim?.language ?? (state.preferredLanguage === 'gcf' ? 'gcf' : 'fr');
      const nextQ = sim
        ? buildJarvisConsultation({
            simulation: sim,
            title: params.title,
            description: params.description,
            tenantFirstName: params.tenantFirstName,
            mode: 'tenant_turn',
          }).nextQuestion
        : null;
      return {
        state,
        acknowledgment: reassurance,
        nextQuestion: nextQ,
        fromLlm: false,
        uiStatus: analyzingStatus(lang),
      };
    }

    const turn = await this.runSimulationConsultation({
      mode: 'tenant_turn',
      state,
      title: params.title,
      description: params.description,
      message: params.message,
      tenantFirstName: params.tenantFirstName,
      wasAlreadyComplete,
      lastAcknowledgment: params.state.answers.jarvis_last_ack,
      residenceUnitNumber: params.residenceUnitNumber,
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

  /** Consultation Jarvis — pont LLM Groq d’abord ; moteur script seulement si pont désactivé ou repli explicite. */
  private isIntakeAlreadyComplete(state: LiaIntakeState): boolean {
    return (
      state.phase === 'DONE' ||
      state.answers.jarvis_intake_complete === 'oui' ||
      parseSimulationFromState(state)?.intakeComplete === true
    );
  }

  private async runSimulationConsultation(params: {
    mode: 'opening' | 'tenant_turn';
    state: LiaIntakeState;
    title: string;
    description: string;
    message: string;
    tenantFirstName?: string;
    wasAlreadyComplete?: boolean;
    lastAcknowledgment?: string;
    residenceUnitNumber?: string;
  }): Promise<JarvisPilotTurn> {
    const prior = parseSimulationFromState(params.state);
    const wasAlreadyComplete =
      params.wasAlreadyComplete ?? this.isIntakeAlreadyComplete(params.state);
    const housing = inferHousingPerspective(
      params.residenceUnitNumber ?? params.state.jarvisFacts?.housing_unit,
    );

    if (this.llmBridge.isEnabled()) {
      const bridged = await this.llmBridge.visualizeMessage({
        mode: params.mode,
        title: params.title,
        description: params.description,
        message: params.message,
        tenantFirstName: params.tenantFirstName,
        preferredLanguage: params.state.preferredLanguage,
        prior,
        priorAcknowledgment: params.lastAcknowledgment,
      });

      if (bridged) {
        if (bridged.handoffRequired) {
          return this.buildHandoffTurn(params.state, {
            acknowledgment: bridged.acknowledgment,
            handoffRequired: true,
            handoffReason: bridged.handoffReason ?? 'complexité',
            language: bridged.simulation.language,
            visualizationNote: bridged.visualizationNote,
          });
        }
        return this.buildTurnFromLlmBridge(
          params,
          bridged,
          housing,
          wasAlreadyComplete,
        );
      }

      if (process.env.JARVIS_LLM_BRIDGE_FALLBACK !== 'true') {
        const lang = normalizeCompanionLanguage(params.state.preferredLanguage);
        this.logger.error(
          'Pont LLM Jarvis indisponible — pas de repli script (JARVIS_LLM_BRIDGE_FALLBACK≠true)',
        );
        return {
          state: params.state,
          acknowledgment:
            'Je rencontre un souci technique avec mon analyse pour l’instant. ' +
            'Réessayez dans quelques secondes ; si cela persiste, contactez votre gestionnaire.',
          nextQuestion: null,
          fromLlm: false,
        };
      }
      this.logger.warn(
        'Pont LLM Jarvis indisponible — repli moteur script (JARVIS_LLM_BRIDGE_FALLBACK=true)',
      );
    }

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

    const simulation = runJarvisSimulation({
      title: params.title,
      description: params.description,
      message: params.message,
      prior,
      preferredLanguage: params.state.preferredLanguage,
      housingKind: housing.kind,
    });

    let state = attachSimulationToState(params.state, simulation);
    const chainQuestion =
      simulation.domain === 'generic' ? pickChainQuestion(simulation, simulation.language) : null;
    const councilRound = runCouncilRound({
      title: params.title,
      description: params.description,
      message: params.message,
      state: params.state,
      simulation,
      housing,
      chainQuestion,
    });

    const consultation = buildJarvisConsultation({
      simulation,
      title: params.title,
      description: params.description,
      tenantFirstName: params.tenantFirstName,
      mode: params.mode,
      postIntake: wasAlreadyComplete && params.mode === 'tenant_turn',
      message: params.message,
      lastAcknowledgment: params.lastAcknowledgment,
    });

    let acknowledgment = consultation.acknowledgment;
    let nextQuestion = pickCouncilSpokenQuestion(
      consultation.nextQuestion,
      councilRound,
      simulation.resolvedSteps,
      simulation.tenantFacts,
    );

    if (params.mode === 'tenant_turn' && params.message.trim()) {
      const voice = synthesizeJarvisFromCouncil({
        name: params.tenantFirstName?.trim() || 'Bonjour',
        lang: simulation.language,
        message: params.message,
        title: params.title,
        description: params.description,
        housingKind: housing.kind,
        simulation,
        councilRound,
        fallbackQuestion: nextQuestion,
      });
      acknowledgment = voice.acknowledgment;
      nextQuestion = voice.nextQuestion;
    }

    state = {
      ...state,
      jarvisFacts: {
        ...(state.jarvisFacts ?? {}),
        housing_unit:
          params.residenceUnitNumber?.trim() ??
          params.state.jarvisFacts?.housing_unit ??
          '',
        housing_kind: housing.kind,
        housing_visual: housing.visualNote,
        council_last: serializeCouncilRound(councilRound),
      },
    };

    let fromLlm = false;
    const voiceSynthesized =
      params.mode === 'tenant_turn' && params.message.trim().length > 0;

    const polished = voiceSynthesized
      ? null
      : await this.maybePolishConsultation({
          consultation,
          tenantFirstName: params.tenantFirstName,
        });
    if (polished) {
      acknowledgment = polished.acknowledgment;
      nextQuestion = polished.nextQuestion ?? nextQuestion;
      fromLlm = true;
    }

    let intakeComplete =
      consultation.intakeComplete ||
      wasAlreadyComplete ||
      simulation.intakeComplete ||
      simulation.resolvedSteps.includes('service_meter_link');
    const newlyComplete = intakeComplete && !wasAlreadyComplete;
    if (intakeComplete) {
      state = {
        ...state,
        phase: 'DONE',
        stepIndex: 0,
        answers: { ...state.answers, jarvis_intake_complete: 'oui' },
      };
      nextQuestion = null;
    } else {
      state = { ...state, phase: 'INTAKE' };
    }

    const lang = normalizeCompanionLanguage(consultation.language);
    if (newlyComplete) {
      acknowledgment = appendJarvisIntakeTransmission(acknowledgment, lang);
    }
    return {
      state: {
        ...state,
        preferredLanguage: lang,
        answers: {
          ...state.answers,
          jarvis_summary: acknowledgment.slice(0, 500),
          jarvis_last_ack: acknowledgment.slice(0, 500),
        },
      },
      acknowledgment,
      nextQuestion,
      fromLlm,
      uiStatus: newlyComplete ? dossierTransmisStatus(lang) : undefined,
      councilRound,
    };
  }

  private buildTurnFromLlmBridge(
    params: {
      mode: 'opening' | 'tenant_turn';
      state: LiaIntakeState;
      title: string;
      description: string;
      message: string;
      residenceUnitNumber?: string;
      tenantFirstName?: string;
      lastAcknowledgment?: string;
    },
    bridged: JarvisLlmBridgeResult,
    housing: ReturnType<typeof inferHousingPerspective>,
    wasAlreadyComplete: boolean,
  ): JarvisPilotTurn {
    let state = attachSimulationToState(params.state, bridged.simulation);
    const llmFacts = Object.fromEntries(
      Object.entries(bridged.extractedFacts).map(([k, v]) => [`llm_${k}`, v]),
    );

    state = {
      ...state,
      jarvisFacts: {
        ...(state.jarvisFacts ?? {}),
        reasoning_source: 'llm_bridge',
        housing_unit:
          params.residenceUnitNumber?.trim() ??
          params.state.jarvisFacts?.housing_unit ??
          '',
        housing_kind: housing.kind,
        housing_visual: housing.visualNote,
        visualization: bridged.visualizationNote,
        council_last: bridged.councilSerialized,
        ...bridged.teamFacts,
        ...llmFacts,
      },
    };

    const acknowledgment = bridged.acknowledgment;
    const nextQuestion = bridged.nextQuestion;
    const intakeComplete = bridged.intakeComplete || wasAlreadyComplete;
    const newlyComplete = intakeComplete && !wasAlreadyComplete;
    const lang = normalizeCompanionLanguage(bridged.simulation.language);

    if (intakeComplete) {
      state = {
        ...state,
        phase: 'DONE',
        stepIndex: 0,
        answers: { ...state.answers, jarvis_intake_complete: 'oui' },
      };
    } else {
      state = { ...state, phase: 'INTAKE' };
    }

    return {
      state: {
        ...state,
        preferredLanguage: lang,
        answers: {
          ...state.answers,
          jarvis_summary: acknowledgment.slice(0, 500),
          jarvis_last_ack: acknowledgment.slice(0, 500),
        },
      },
      acknowledgment,
      nextQuestion: intakeComplete ? null : nextQuestion,
      fromLlm: true,
      uiStatus: newlyComplete ? dossierTransmisStatus(lang) : undefined,
      councilRound: parseCouncilRound(bridged.councilSerialized) ?? undefined,
    };
  }

  private async maybePolishConsultation(params: {
    consultation: ReturnType<typeof buildJarvisConsultation>;
    tenantFirstName?: string;
  }): Promise<{ acknowledgment: string; nextQuestion: string | null } | null> {
    if (process.env.LIA_HOST_ENABLED === 'false') return null;
    if (process.env.JARVIS_LLM_POLISH !== 'true') return null;

    const user = JSON.stringify({
      tenantFirstName: params.tenantFirstName ?? 'Marie',
      language: params.consultation.language,
      acknowledgment: params.consultation.acknowledgment,
      nextQuestion: params.consultation.nextQuestion,
      visualizationNote: params.consultation.visualizationNote,
    });

    const raw = await this.host.chatStructured(JARVIS_POLISH_SYSTEM, user, 400);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as JarvisLlmPayload;
      if (!parsed.acknowledgment?.trim()) return null;
      return {
        acknowledgment: parsed.acknowledgment.trim(),
        nextQuestion: parsed.nextQuestion?.trim() ?? params.consultation.nextQuestion,
      };
    } catch {
      this.logger.warn('Polish Jarvis JSON invalide — consultation simulation conservée');
      return null;
    }
  }

  private buildHandoffTurn(
    state: LiaIntakeState,
    parsed: JarvisLlmPayload,
  ): JarvisPilotTurn {
    const lang = normalizeCompanionLanguage(parsed.language ?? 'fr');
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
}

export { isSimulationIntakeComplete };
