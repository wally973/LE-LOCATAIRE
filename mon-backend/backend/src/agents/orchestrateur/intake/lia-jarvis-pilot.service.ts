/**
 * Pilote Jarvis — Living Intelligence uniquement (LIVING_BUILDING_STATE).
 * Aucun script, aucune nextQuestion, aucune prédiction de parole.
 */
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import type { LiaMessageUiStatus } from '../conversation/lia-message-ui-status';
import { normalizeCompanionLanguage } from '../../shared/lia-dialogue-languages';
import {
  LiaIntakeService,
  type LiaIntakeState,
} from './lia-intake.service';
import {
  applyJarvisLanguageToState,
} from './lia-jarvis-intake.engine';
import { LiaJarvisHandoffService } from './lia-jarvis-handoff.service';
import { inferHousingPerspective } from './lia-housing-perspective';
import { DiagnosticContextService } from '../../shared/diagnostic-context.service';
import { buildLabTenantSocialContext } from '../../shared/lia-tenant-social-context';
import type {
  LiaInterlocutorRole,
  LiaTenantAgeBand,
  LiaTenantSocialContext,
} from '../../shared/lia-jarvis-identity';
import { LivingReasoningService } from '../living-intelligence/living-reasoning.service';
import { isLivingIntelligenceEnabled } from '../living-intelligence/living-intelligence.config';
import { createLivingBuildingState } from '../living-intelligence/living-building-state.factory';
import { nuclearFlushLivingState } from '../living-intelligence/living-tabula-rasa';
import { writeLivingStateToIntake } from '../living-intelligence/living-building-state.repository';
import type { LivingBuildingState } from '../living-intelligence/living-building-state.types';

export interface JarvisPilotTurn {
  state: LiaIntakeState;
  acknowledgment: string;
  /** Toujours null — parole unique dans acknowledgment (Living Intelligence). */
  nextQuestion: null;
  uiStatus?: LiaMessageUiStatus;
  fromLlm: boolean;
  handoffTriggered?: boolean;
  /** Table de vérité — technicien + locataire */
  buildingState?: LivingBuildingState;
}

@Injectable()
export class LiaJarvisPilotService {
  private readonly logger = new Logger(LiaJarvisPilotService.name);

  constructor(
    private readonly intake: LiaIntakeService,
    private readonly handoff: LiaJarvisHandoffService,
    private readonly diagnosticContext: DiagnosticContextService,
    private readonly livingReasoning: LivingReasoningService,
  ) {}

  bootstrapState(
    title: string,
    description: string,
    preferredLanguage = 'fr',
    residenceUnitNumber?: string,
  ): LiaIntakeState {
    this.assertLivingEnabled();
    const lang = preferredLanguage.trim() || 'fr';
    const housing = inferHousingPerspective(residenceUnitNumber);
    let state = this.intake.createInitialState(title, description);
    const langNorm = normalizeCompanionLanguage(lang);
    const initial = nuclearFlushLivingState(
      createLivingBuildingState({
        title,
        description,
        language: langNorm,
        creolePreferred: langNorm === 'gcf',
      }),
    );

    state = {
      ...state,
      intakeMode: 'jarvis',
      preferredLanguage: lang,
      phase: 'INTAKE',
      stepIndex: 0,
      answers: { ...state.answers, language_preference: lang },
      jarvisFacts: {
        ...(state.jarvisFacts ?? {}),
        langue_choisie: 'oui',
        housing_unit: residenceUnitNumber?.trim() ?? '',
        housing_kind: housing.kind,
        housing_visual: housing.visualNote,
        reasoning_source: 'living_intelligence',
        ...writeLivingStateToIntake({}, initial),
      },
      skippedQuestionIds: [],
    };
    state = applyJarvisLanguageToState(state, title, description);
    return state;
  }

  async runOpening(params: {
    state: LiaIntakeState;
    title: string;
    description: string;
    tenantFirstName?: string;
    ticketId?: number;
    residenceUnitNumber?: string;
    tenantSocial?: LiaTenantSocialContext | null;
  }): Promise<JarvisPilotTurn> {
    this.assertLivingEnabled();
    let state = applyJarvisLanguageToState(
      params.state,
      params.title,
      params.description,
    );

    const turn = await this.runLivingTurn({
      mode: 'opening',
      state,
      title: params.title,
      description: params.description,
      message: '',
      tenantFirstName: params.tenantFirstName,
      residenceUnitNumber: params.residenceUnitNumber,
      ticketId: params.ticketId,
      tenantSocial: params.tenantSocial,
    });

    if (turn.handoffTriggered && params.ticketId) {
      await this.handoff.dispatchSectorTechnician({
        ticketId: params.ticketId,
        intake: turn.state,
        reason: turn.state.jarvisFacts?.handoff_reason ?? 'Dossier qualifié technicien',
        visualizationNote:
          turn.buildingState?.intervention?.technicianSummary ?? undefined,
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
    tenantSocial?: LiaTenantSocialContext | null;
  }): Promise<JarvisPilotTurn> {
    this.assertLivingEnabled();
    const wasAlreadyComplete = this.isIntakeAlreadyComplete(params.state);

    let state = applyJarvisLanguageToState(
      params.state,
      params.title,
      params.description,
      params.message,
    );

    const turn = await this.runLivingTurn({
      mode: 'tenant_turn',
      state,
      title: params.title,
      description: params.description,
      message: params.message,
      tenantFirstName: params.tenantFirstName,
      residenceUnitNumber: params.residenceUnitNumber,
      ticketId: params.ticketId,
      tenantSocial: params.tenantSocial,
      wasAlreadyComplete,
    });

    if (turn.handoffTriggered && params.ticketId) {
      await this.handoff.dispatchSectorTechnician({
        ticketId: params.ticketId,
        intake: turn.state,
        reason: turn.state.jarvisFacts?.handoff_reason ?? 'Dossier qualifié technicien',
        visualizationNote:
          turn.buildingState?.intervention?.technicianSummary ?? undefined,
      });
    }

    await this.maybeDispatchSocialReferral(params, turn);
    await this.maybeDispatchArtisanReferral(params, turn);
    return turn;
  }

  private assertLivingEnabled(): void {
    if (!isLivingIntelligenceEnabled()) {
      throw new ServiceUnavailableException(
        'Living Intelligence indisponible — configurez GROQ_API_KEY (LIVING_INTELLIGENCE=false pour désactiver).',
      );
    }
  }

  private isIntakeAlreadyComplete(state: LiaIntakeState): boolean {
    return (
      state.phase === 'DONE' || state.answers.jarvis_intake_complete === 'oui'
    );
  }

  private async runLivingTurn(params: {
    mode: 'opening' | 'tenant_turn';
    state: LiaIntakeState;
    title: string;
    description: string;
    message: string;
    tenantFirstName?: string;
    wasAlreadyComplete?: boolean;
    residenceUnitNumber?: string;
    ticketId?: number;
    tenantSocial?: LiaTenantSocialContext | null;
  }): Promise<JarvisPilotTurn> {
    const tenantSocial = await this.resolveTenantSocialForTurn({
      ticketId: params.ticketId,
      tenantFirstName: params.tenantFirstName,
      title: params.title,
      state: params.state,
      explicit: params.tenantSocial,
    });

    const result = await this.livingReasoning.runTurn({
      ...params,
      tenantSocial,
      wasAlreadyComplete: params.wasAlreadyComplete,
    });

    return {
      ...result,
      nextQuestion: null,
      buildingState: result.buildingState as LivingBuildingState | undefined,
    };
  }

  private async resolveTenantSocialForTurn(params: {
    ticketId?: number;
    tenantFirstName?: string;
    title: string;
    state: LiaIntakeState;
    explicit?: LiaTenantSocialContext | null;
  }): Promise<LiaTenantSocialContext | null> {
    if (params.explicit) return params.explicit;
    if (params.ticketId) {
      const ctx = await this.diagnosticContext.fromTicket(params.ticketId);
      return ctx.tenantSocial;
    }
    const facts = params.state.jarvisFacts ?? {};
    return buildLabTenantSocialContext({
      tenantFirstName: params.tenantFirstName,
      ageBand: facts.tenant_age_band as LiaTenantAgeBand | undefined,
      interlocutorRole: facts.tenant_interlocutor_role as LiaInterlocutorRole | undefined,
      lastClosedTicketSummary: facts.tenant_last_closed_summary,
      lastClosedTicketTitle: facts.tenant_last_closed_title,
      currentTitle: params.title,
    });
  }

  private async maybeDispatchSocialReferral(
    params: { ticketId?: number; message: string; state: LiaIntakeState },
    turn: JarvisPilotTurn,
  ): Promise<void> {
    if (!params.ticketId) return;
    if (turn.state.answers.jarvis_social_handoff === 'fait') return;
    if (turn.state.jarvisFacts?.social_handoff !== 'recommande') return;

    await this.handoff.dispatchSocialReferral({
      ticketId: params.ticketId,
      tenantMessage: params.message,
      intake: turn.state,
      reason: 'Détresse financière signalée — handoff social.',
    });
    turn.state = {
      ...turn.state,
      answers: { ...turn.state.answers, jarvis_social_handoff: 'fait' },
    };
  }

  private async maybeDispatchArtisanReferral(
    params: { ticketId?: number; message: string },
    turn: JarvisPilotTurn,
  ): Promise<void> {
    if (!params.ticketId) return;
    if (turn.state.answers.jarvis_artisan_handoff === 'fait') return;
    if (turn.state.jarvisFacts?.artisan_handoff !== 'recommande') return;

    await this.handoff.dispatchArtisanReferral({
      ticketId: params.ticketId,
      tenantMessage: params.message,
      reason: 'Orientation artisan à charge locataire.',
    });
    turn.state = {
      ...turn.state,
      answers: { ...turn.state.answers, jarvis_artisan_handoff: 'fait' },
    };
  }
}
