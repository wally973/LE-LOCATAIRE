/**
 * Cœur de raisonnement — INPUT → DÉLIBÉRATION → GARDIEN → OUTPUT.
 */
import { Injectable } from '@nestjs/common';
import type { LiaIntakeState } from '../intake/lia-intake.service';
import type { JarvisPilotTurn } from '../intake/lia-jarvis-pilot.service';
import { normalizeCompanionLanguage } from '../../shared/lia-dialogue-languages';
import type { CompanionLanguage } from '../conversation/lia-companion.types';
import type { LiaTenantSocialContext } from '../../shared/lia-jarvis-identity';
import { LivingDeliberationEngine } from './living-deliberation.engine';
import { LivingGuardianService } from './living-guardian.service';
import type { LivingDeliberationTurnResult } from './living-building-state.types';
import {
  LivingBuildingStateRepository,
  readLivingStateFromIntake,
  writeLivingStateToIntake,
} from './living-building-state.repository';
import { createLivingBuildingState } from './living-building-state.factory';
import {
  buildNewDossierRequestMessage,
  detectDossierTopicBreach,
  sealDossierIntegrity,
} from './living-dossier-integrity';
import { isConfirmedTopicChange } from '../intake/lia-jarvis-intake.engine';
import {
  nuclearFlushJarvisFacts,
  nuclearFlushLivingState,
} from './living-tabula-rasa';
import { dossierTransmisStatus } from '../conversation/lia-message-ui-status';

@Injectable()
export class LivingReasoningService {
  constructor(
    private readonly deliberation: LivingDeliberationEngine,
    private readonly guardian: LivingGuardianService,
    private readonly repository: LivingBuildingStateRepository,
  ) {}

  /** Délibération + revue souveraine du Gardien (Phase B). */
  private async runGuardedTurn(params: {
    living: import('./living-building-state.types').LivingBuildingState;
    message: string;
    mode: 'opening' | 'tenant_turn';
    social?: LiaTenantSocialContext | null;
  }): Promise<LivingDeliberationTurnResult> {
    let result = await this.deliberation.deliberate({
      state: params.living,
      tenantMessage: params.message,
      mode: params.mode,
      tenantSocial: params.social,
    });

    let review = this.guardian.review({
      result,
      tenantSocial: params.social,
      pendingDoctrineLessons: result.pendingDoctrineLessons ?? [],
    });

    if (review.verdict === 'RE-DELIBERATE' && review.redeliberationBrief) {
      result = await this.deliberation.deliberate({
        state: review.livingState,
        tenantMessage: params.message,
        mode: params.mode,
        tenantSocial: params.social,
        guardianRedeliberationNote: review.redeliberationBrief,
      });
      review = this.guardian.review({
        result,
        tenantSocial: params.social,
        pendingDoctrineLessons: result.pendingDoctrineLessons ?? [],
      });
    }

    const tenantMessage =
      review.verdict === 'OVERRIDE' ? review.finalParole : result.tenantMessage;

    return {
      ...result,
      tenantMessage,
      livingState: {
        ...review.livingState,
        guardianReview: {
          ...review.livingState.guardianReview!,
          verdict: review.verdict,
          finalParole: tenantMessage,
        },
        doctrinePending: result.pendingDoctrineLessons ?? review.livingState.doctrinePending,
      },
    };
  }

  async runTurn(params: {
    mode: 'opening' | 'tenant_turn';
    state: LiaIntakeState;
    title: string;
    description: string;
    message: string;
    tenantFirstName?: string;
    tenantSocial?: LiaTenantSocialContext | null;
    ticketId?: number;
    wasAlreadyComplete?: boolean;
  }): Promise<JarvisPilotTurn> {
    const lang = normalizeCompanionLanguage(params.state.preferredLanguage);
    const social = params.tenantSocial;

    let living =
      readLivingStateFromIntake(params.state.jarvisFacts) ??
      (params.ticketId ? await this.repository.loadForTicket(params.ticketId) : null) ??
      createLivingBuildingState({
        title: params.title,
        description: params.description,
        language: lang,
        tenantFirstName: params.tenantFirstName,
        ageBand: social?.ageBand,
        livesAlone: true,
        creolePreferred: lang === 'gcf',
      });

    living = sealDossierIntegrity(living);
    if (params.wasAlreadyComplete && !living.dossierIntegrity.sealed) {
      living = sealDossierIntegrity({
        ...living,
        readiness: 'READY_FOR_TECHNICIAN',
        intervention: {
          ...living.intervention,
          readyForDispatch: true,
        },
      });
    }

    if (params.wasAlreadyComplete && params.message.trim()) {
      const breach = detectDossierTopicBreach({
        state: living,
        message: params.message,
        intakeCategory: params.state.category,
      });
      if (breach.isNewSubject) {
        const parole = buildNewDossierRequestMessage(
          living.humanBarrier.displayName,
          breach.detectedLabel,
          living.language === 'gcf' ? 'gcf' : 'fr',
        );
        return {
          state: {
            ...params.state,
            phase: 'DONE',
            answers: {
              ...params.state.answers,
              jarvis_intake_complete: 'oui',
              jarvis_last_ack: parole.slice(0, 500),
            },
            jarvisFacts: writeLivingStateToIntake(params.state.jarvisFacts, living),
          },
          acknowledgment: parole,
          nextQuestion: null,
          fromLlm: false,
          handoffTriggered: false,
          buildingState: living,
        };
      }
    }

    const topicChangedDuringIntake =
      params.mode === 'tenant_turn' &&
      params.message.trim() &&
      isConfirmedTopicChange(
        params.message,
        params.title,
        params.description,
        params.state.category ?? null,
      );

    if (topicChangedDuringIntake) {
      living = createLivingBuildingState({
        title: params.title,
        description: params.description,
        language: lang,
        tenantFirstName: params.tenantFirstName ?? living.humanBarrier.displayName,
        ageBand: social?.ageBand ?? living.humanBarrier.ageBand,
        livesAlone: living.humanBarrier.livesAlone,
        creolePreferred: living.humanBarrier.creolePreferred,
      });
    } else {
      living = nuclearFlushLivingState(living);
    }

    params.state = {
      ...params.state,
      jarvisFacts: nuclearFlushJarvisFacts(params.state.jarvisFacts),
    };

    const result = await this.runGuardedTurn({
      living,
      message: params.message,
      mode: params.mode,
      social,
    });

    living = sealDossierIntegrity(result.livingState);

    if (params.ticketId) {
      await this.repository.saveForTicket(params.ticketId, living);
    }

    const intakeComplete = result.intakeComplete || params.wasAlreadyComplete === true;
    const newlyComplete = intakeComplete && !params.wasAlreadyComplete;

    return {
      state: {
        ...params.state,
        phase: intakeComplete ? 'DONE' : 'INTAKE',
        stepIndex: 0,
        preferredLanguage: living.language,
        intakeMode: 'jarvis',
        answers: {
          ...params.state.answers,
          jarvis_intake_complete: intakeComplete ? 'oui' : 'non',
          jarvis_summary: result.tenantMessage.slice(0, 500),
          jarvis_last_ack: result.tenantMessage.slice(0, 500),
        },
        jarvisFacts: writeLivingStateToIntake(params.state.jarvisFacts, living),
        skippedQuestionIds: [],
      },
      acknowledgment: result.tenantMessage,
      nextQuestion: null,
      fromLlm: true,
      handoffTriggered: result.handoffRequired,
      buildingState: living as unknown as JarvisPilotTurn['buildingState'],
      uiStatus: newlyComplete
        ? dossierTransmisStatus(living.language as CompanionLanguage)
        : undefined,
    };
  }
}
