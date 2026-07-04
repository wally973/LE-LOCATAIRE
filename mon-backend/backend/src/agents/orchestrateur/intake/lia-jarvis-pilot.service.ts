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
import { LiaTicketFinalizerService } from './lia-ticket-finalizer.service';
import { LiaConversationService } from '../conversation/lia-conversation.service';
import { uiStatusForResponsibility } from '../conversation/lia-message-ui-status';
import type { GrockConversationState } from '../../../grock/grock.service';
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
import { forgePristineLivingState, purgeJarvisCognitiveFacts } from '../living-intelligence/living-tabula-rasa';
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
  /** État structuré renvoyé par Grock (auto-conclusion, handoff). */
  grockState?: GrockConversationState;
  grockNextAction?: string;
  grockNoteInterne?: string | null;
  /** Conclusion immédiate bailleur — évite double envoi fil. */
  autoConclusionApplied?: boolean;
}

/** Réponse structurée Grock utilisée pour l’auto-conclusion. */
export interface GrockReply {
  next_action?: string;
  acknowledgment?: string;
  state?: GrockConversationState;
  note_interne?: string | null;
}

export interface ImmediateConclusion {
  type: 'conclusion';
  text: string;
}

@Injectable()
export class LiaJarvisPilotService {
  private readonly logger = new Logger(LiaJarvisPilotService.name);

  constructor(
    private readonly intake: LiaIntakeService,
    private readonly handoff: LiaJarvisHandoffService,
    private readonly diagnosticContext: DiagnosticContextService,
    private readonly livingReasoning: LivingReasoningService,
    private readonly conversation: LiaConversationService,
    private readonly ticketFinalizer: LiaTicketFinalizerService,
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
    const initial = forgePristineLivingState({
      title,
      description,
      language: langNorm,
      creolePreferred: langNorm === 'gcf',
    });

    state = {
      ...state,
      intakeMode: 'jarvis',
      preferredLanguage: lang,
      phase: 'INTAKE',
      stepIndex: 0,
      answers: { language_preference: lang, jarvis_intake_complete: 'non' },
      jarvisFacts: {
        ...purgeJarvisCognitiveFacts({}),
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
      message: this.formatSignalementForGrock(params.title, params.description),
      tenantFirstName: params.tenantFirstName,
      residenceUnitNumber: params.residenceUnitNumber,
      ticketId: params.ticketId,
      tenantSocial: params.tenantSocial,
    });

    // Si Grock conclut dès l'ouverture (verdict propre, pas ai-routing parallèle),
    // on agit tout de suite : sinon Marie reste bloquée sur l'alerte sécurité.
    const resolved = await this.applyGrockTerminalConclusion(turn, {
      ticketId: params.ticketId,
      tenantFirstName: params.tenantFirstName,
    });

    if (
      !resolved.autoConclusionApplied &&
      resolved.handoffTriggered &&
      params.ticketId
    ) {
      await this.handoff.dispatchSectorTechnician({
        ticketId: params.ticketId,
        intake: resolved.state,
        reason:
          resolved.state.jarvisFacts?.handoff_reason ?? 'Dossier qualifié technicien',
        visualizationNote:
          resolved.buildingState?.intervention?.technicianSummary ?? undefined,
      });
    }
    return resolved;
  }

  /**
   * Conclusion terminale Grock (sinistre / bailleur / locataire).
   * Deux INVARIANTS de code seulement — aucun scénario métier :
   *  - INV1 (preuve avant conclusion) : si Grock réclame encore une preuve
   *    (photo) pour trancher, on sonde d'abord, puis on conclut au tour suivant.
   *  - INV2 (parole = Grock) : le message au locataire est TOUJOURS
   *    l'acknowledgment produit par Grock, jamais un texte métier codé en dur.
   */
  private async applyGrockTerminalConclusion(
    turn: JarvisPilotTurn,
    params: {
      ticketId?: number;
      tenantFirstName?: string;
      alreadyGated?: boolean;
    },
  ): Promise<JarvisPilotTurn> {
    if (!params.ticketId) return turn;
    const terminal =
      turn.grockState === 'sinistre' ||
      turn.grockState === 'bailleur_responsable' ||
      turn.grockState === 'locataire_responsable';

    // INV1 — le sondage a déjà eu lieu : la réponse (photo ou texte) CONCLUT
    // toujours, de façon déterministe. Si Grock ne renvoie pas d'état terminal
    // ce tour-ci (message quasi vide, photo non « vue »), on reprend l'état
    // terminal mémorisé au sondage (pending_conclusion) pour ne jamais laisser
    // le locataire sans retour.
    if (params.alreadyGated) {
      const pending = turn.state.jarvisFacts
        ?.pending_conclusion as GrockConversationState | undefined;
      const concludingState: GrockConversationState =
        (terminal ? turn.grockState : pending) ?? 'bailleur_responsable';
      const concludingTurn: JarvisPilotTurn = terminal
        ? turn
        : { ...turn, grockState: concludingState };
      return this.applyGrockConclusion(concludingTurn, {
        ticketId: params.ticketId,
        tenantFirstName: params.tenantFirstName,
      });
    }

    if (!terminal) return turn;

    if (this.grockRequestsConfirmationPhoto(turn)) {
      return this.applyEvidenceGate(turn, params.ticketId);
    }
    return this.applyGrockConclusion(turn, {
      ticketId: params.ticketId,
      tenantFirstName: params.tenantFirstName,
    });
  }

  /** INV1 — Grock conclut mais réclame une preuve (photo) pour trancher. */
  private grockRequestsConfirmationPhoto(turn: JarvisPilotTurn): boolean {
    const text = `${turn.grockNextAction ?? ''} ${turn.acknowledgment ?? ''} ${
      turn.grockNoteInterne ?? ''
    }`
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '');
    const asksPhoto = /photo|photographi/.test(text);
    const toConfirm =
      /confirmer|verifier|a verifier|determiner|orienter|origine|responsabilit|sans photo|utile pour/.test(
        text,
      );
    return asksPhoto && toConfirm;
  }

  /**
   * INV1 — Étape 1 : on sonde. Le message vient de Grock (sécurité, consigne,
   * demande de photo… tout ce que Grock a formulé). Aucune conclusion, aucun
   * handoff, aucun bandeau tant que la preuve/réponse n'est pas revenue.
   */
  private async applyEvidenceGate(
    turn: JarvisPilotTurn,
    ticketId: number,
  ): Promise<JarvisPilotTurn> {
    this.logger.debug(`[FLUX] Sondage avant conclusion (${turn.grockState})`);
    const locale = turn.state.preferredLanguage === 'gcf' ? 'gcf-GP' : 'fr-FR';
    const text = this.tenantMessageFromGrock(turn);

    await this.conversation.appendMessage(ticketId, 'LIA_HOST', text, locale);

    const gatedIntake: LiaIntakeState = {
      ...turn.state,
      phase: 'AWAITING_PHOTO',
      answers: {
        ...turn.state.answers,
        jarvis_intake_complete: 'non',
      },
      jarvisFacts: {
        ...(turn.state.jarvisFacts ?? {}),
        awaiting_conclusion_photo: 'oui',
        pending_conclusion: turn.grockState ?? '',
      },
    };

    return {
      ...turn,
      state: gatedIntake,
      acknowledgment: text,
      handoffTriggered: false,
      autoConclusionApplied: true,
    };
  }

  /** INV2 — conclusion réelle : message = parole de Grock, métadonnées selon l'état. */
  private async applyGrockConclusion(
    turn: JarvisPilotTurn,
    params: { ticketId: number; tenantFirstName?: string },
  ): Promise<JarvisPilotTurn> {
    switch (turn.grockState) {
      case 'sinistre':
        return this.applySinistreConclusion(turn, params);
      case 'locataire_responsable':
        return this.applyLocataireConclusion(turn, params);
      default:
        return this.applyBailleurConclusion(turn, params);
    }
  }

  /** INV2 — la parole au locataire vient TOUJOURS de Grock (repli neutre minimal). */
  private tenantMessageFromGrock(turn: JarvisPilotTurn): string {
    return (
      turn.acknowledgment?.trim() ||
      turn.grockNextAction?.trim() ||
      'C’est noté, je m’occupe de votre dossier.'
    );
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

    let state = applyJarvisLanguageToState(
      params.state,
      params.title,
      params.description,
      params.message,
    );

    const tenantMessage = params.message.trim();
    if (state.answers.grock_last_tenant_message !== tenantMessage) {
      state = {
        ...state,
        grockAlreadyCalled: false,
        lastGrockReply: null,
        answers: {
          ...state.answers,
          grock_last_tenant_message: tenantMessage,
        },
      };
    }

    if (state.grockAlreadyCalled && state.lastGrockReply) {
      return state.lastGrockReply;
    }
    state = { ...state, grockAlreadyCalled: true };

    const wasAlreadyComplete = this.isIntakeAlreadyComplete(state);

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

    // alreadyGated lu sur l'état d'ENTRÉE (anti-boucle) : au tour suivant le
    // sondage, on conclut quel que soit ce que Grock redemande.
    const alreadyGated =
      state.jarvisFacts?.awaiting_conclusion_photo === 'oui';
    const resolvedTurn = await this.applyGrockTerminalConclusion(turn, {
      ticketId: params.ticketId,
      tenantFirstName: params.tenantFirstName,
      alreadyGated,
    });

    const cachedTurn: JarvisPilotTurn = {
      ...resolvedTurn,
      state: {
        ...resolvedTurn.state,
        grockAlreadyCalled: true,
        lastGrockReply: null,
      },
    };
    const result: JarvisPilotTurn = {
      ...cachedTurn,
      state: {
        ...cachedTurn.state,
        lastGrockReply: cachedTurn,
      },
    };

    if (
      !result.autoConclusionApplied &&
      result.handoffTriggered &&
      params.ticketId
    ) {
      await this.handoff.dispatchSectorTechnician({
        ticketId: params.ticketId,
        intake: result.state,
        reason: result.state.jarvisFacts?.handoff_reason ?? 'Dossier qualifié technicien',
        visualizationNote:
          result.buildingState?.intervention?.technicianSummary ?? undefined,
      });
    }

    await this.maybeDispatchSocialReferral(params, result);
    await this.maybeDispatchArtisanReferral(params, result);
    return result;
  }

  /** Conclusion SINISTRE — message = parole de Grock, métadonnées assurance + technicien. */
  private async applySinistreConclusion(
    turn: JarvisPilotTurn,
    params: { ticketId: number; tenantFirstName?: string },
  ): Promise<JarvisPilotTurn> {
    this.logger.debug('[FLUX] Conclusion sinistre');
    const lang = turn.state.preferredLanguage === 'gcf' ? 'gcf' : 'fr';
    const locale = lang === 'gcf' ? 'gcf-GP' : 'fr-FR';
    const uiStatus = uiStatusForResponsibility('BAILLEUR', lang);
    const text = this.tenantMessageFromGrock(turn);

    await this.conversation.appendMessage(
      params.ticketId,
      'LIA_HOST',
      text,
      locale,
      uiStatus ? { uiStatus } : undefined,
    );

    await this.ticketFinalizer.finalizeTicketForSinistre({
      ticketId: params.ticketId,
      intake: turn.state,
      conclusion: text,
      reason: turn.grockNextAction,
      noteInterne: turn.grockNoteInterne,
      visualizationNote:
        turn.buildingState?.intervention?.technicianSummary ?? undefined,
    });

    return this.concludedTurn(turn, text, uiStatus, 'sinistre', true);
  }

  /** Conclusion BAILLEUR — message = parole de Grock, transmission technicien. */
  private async applyBailleurConclusion(
    turn: JarvisPilotTurn,
    params: { ticketId: number; tenantFirstName?: string },
  ): Promise<JarvisPilotTurn> {
    this.logger.debug('[FLUX] Conclusion bailleur');
    const lang = turn.state.preferredLanguage === 'gcf' ? 'gcf' : 'fr';
    const locale = lang === 'gcf' ? 'gcf-GP' : 'fr-FR';
    const uiStatus = uiStatusForResponsibility('BAILLEUR', lang);
    const text = this.tenantMessageFromGrock(turn);

    await this.conversation.appendMessage(
      params.ticketId,
      'LIA_HOST',
      text,
      locale,
      uiStatus ? { uiStatus } : undefined,
    );

    await this.ticketFinalizer.finalizeTicketForBailleur({
      ticketId: params.ticketId,
      intake: turn.state,
      conclusion: text,
      reason: turn.grockNextAction,
      visualizationNote:
        turn.buildingState?.intervention?.technicianSummary ?? undefined,
    });

    return this.concludedTurn(turn, text, uiStatus, 'bailleur_responsable', true);
  }

  /** Conclusion LOCATAIRE — message = parole de Grock, dossier non recevable. */
  private async applyLocataireConclusion(
    turn: JarvisPilotTurn,
    params: { ticketId: number; tenantFirstName?: string },
  ): Promise<JarvisPilotTurn> {
    this.logger.debug('[FLUX] Conclusion locataire');
    const lang = turn.state.preferredLanguage === 'gcf' ? 'gcf' : 'fr';
    const locale = lang === 'gcf' ? 'gcf-GP' : 'fr-FR';
    const uiStatus = uiStatusForResponsibility('LOCATAIRE', lang);
    const text = this.tenantMessageFromGrock(turn);

    await this.conversation.appendMessage(
      params.ticketId,
      'LIA_HOST',
      text,
      locale,
      uiStatus ? { uiStatus } : undefined,
    );

    await this.ticketFinalizer.finalizeTicketAsNonRecevable(params.ticketId, {
      reason: 'usage_locataire',
      category: turn.state.category,
      domain: turn.grockState,
      conclusion: text,
      intake: turn.state,
    });

    return this.concludedTurn(
      turn,
      text,
      uiStatus,
      'locataire_responsable',
      false,
    );
  }

  /** Finalise l'état intake d'un tour conclu (facteur commun aux 3 conclusions). */
  private concludedTurn(
    turn: JarvisPilotTurn,
    text: string,
    uiStatus: LiaMessageUiStatus | undefined,
    autoConclusion: string,
    handoffTriggered: boolean,
  ): JarvisPilotTurn {
    const intakeDone: LiaIntakeState = {
      ...turn.state,
      phase: 'DONE',
      answers: {
        ...turn.state.answers,
        jarvis_intake_complete: 'oui',
        jarvis_auto_conclusion: autoConclusion,
      },
    };
    return {
      ...turn,
      state: intakeDone,
      acknowledgment: text,
      uiStatus,
      handoffTriggered,
      autoConclusionApplied: true,
    };
  }

  private formatSignalementForGrock(title: string, description: string): string {
    const t = title.trim();
    const d = description.trim();
    if (!d) return t;
    if (!t || t === d) return d;
    const tBase = t.replace(/…$/u, '').trim();
    if (d.includes(tBase) && tBase.length > 10) return d;
    if (t.includes(d)) return t;
    return `${t}\n\n${d}`;
  }

  private assertLivingEnabled(): void {
    if (!isLivingIntelligenceEnabled()) {
      throw new ServiceUnavailableException(
        'Living Intelligence indisponible — configurez MISTRAL_API_KEY (Grock) ou GROQ_API_KEY (LIVING_INTELLIGENCE=false pour désactiver).',
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
