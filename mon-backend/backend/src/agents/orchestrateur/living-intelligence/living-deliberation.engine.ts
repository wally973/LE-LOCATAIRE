/**
 * Délibération Symétrique Niveau 6 — Instruments d’abord, Majordome ensuite.
 */
import { Injectable, Logger } from '@nestjs/common';
import { LiaHostService } from '../conversation/lia-host.service';
import { formatTenantSocialLandscapeBlock } from '../../shared/lia-jarvis-identity';
import type { LiaTenantSocialContext } from '../../shared/lia-jarvis-identity';
import type {
  LivingBuildingState,
  LivingDeliberationEcho,
  LivingDeliberationTurnResult,
} from './living-building-state.types';
import {
  GROQ_MODEL_ARCHIVISTE,
  GROQ_MODEL_ENQUETEUR,
  GROQ_MODEL_MAJORDOME,
} from './living-intelligence.config';
import { mergeLivingPatches } from './living-building-state.merge';
import {
  applyLivingSafetyVerification,
  isLivingSafetyLockActive,
  LIVING_SAFETY_LOCK_MAJORDOME,
} from './living-building-state.safety';
import { prepareLivingSavoirForDeliberation } from './living-savoir-consultation';
import {
  buildMajordomeConsciousnessBrief,
  buildSocialProtectionPerception,
  JARVIS_EXPERT_HANDOFF_FR,
  resolveTenantProfile,
  sanitizeTenantMessageForVulnerability,
  signalementImpliesPhysicalEffort,
} from './living-professional-consciousness';
import { buildInstrumentsBoard } from './living-instruments-board';
import { buildRolePrismBrief, resolveInterlocutorFace } from './living-role-prism';
import { evaluateSymmetricContradiction } from './living-symmetric-contradiction';
import { SYMMETRIC_LEVEL } from './living-symmetric-doctrine';
import { bumpStateToSymmetricLevel6 } from './living-symmetric.factory';
import {
  buildArchivisteSystemPrompt,
  buildEnqueteurSystemPrompt,
  buildMajordomeFactsSystemPrompt,
  buildMajordomeSpeakSystemPrompt,
} from './living-team-roles';

function llmJson(raw: string | null): Record<string, unknown> | null {
  if (!raw?.trim()) return null;
  let text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();
  try {
    const p = JSON.parse(text) as unknown;
    return p && typeof p === 'object' ? (p as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function asString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  return '';
}

function cleanNaturalParole(raw: string | null): string {
  if (!raw?.trim()) return '';
  let text = raw.trim();
  if (text.startsWith('{')) {
    const parsed = llmJson(text);
    if (parsed) {
      const inner =
        asString(parsed.tenantMessage) ||
        asString(parsed.message) ||
        asString(parsed.response);
      if (inner) return inner;
    }
    return '';
  }
  return text.replace(/^["']|["']$/g, '');
}

@Injectable()
export class LivingDeliberationEngine {
  private readonly logger = new Logger(LivingDeliberationEngine.name);

  constructor(private readonly host: LiaHostService) {}

  async deliberate(params: {
    state: LivingBuildingState;
    tenantMessage: string;
    mode: 'opening' | 'tenant_turn';
    tenantSocial?: LiaTenantSocialContext | null;
  }): Promise<LivingDeliberationTurnResult> {
    const face = resolveInterlocutorFace(params.tenantSocial);
    let state: LivingBuildingState = bumpStateToSymmetricLevel6({
      ...params.state,
      lastTenantMessage: params.tenantMessage.trim() || null,
      readiness: 'DELIBERATING',
      updatedAt: new Date().toISOString(),
    }, face);

    if (params.mode === 'tenant_turn' && params.tenantMessage.trim()) {
      state = applyLivingSafetyVerification(state, params.tenantMessage);
    }

    state = {
      ...state,
      tenantProfile: resolveTenantProfile(state, params.tenantSocial),
    };

    const contradiction =
      face === 'technicien' || face === 'equipe_test'
        ? evaluateSymmetricContradiction(state, params.tenantMessage)
        : { shouldChallenge: false, politeChallengeFr: null, challengeBrief: null, missingVisualLogic: [] };

    const protectionBrief = buildSocialProtectionPerception(
      state.tenantProfile,
      signalementImpliesPhysicalEffort(state),
    );

    const savoir = prepareLivingSavoirForDeliberation({
      title: state.signalementTitle,
      description: state.signalementDescription,
      message: params.tenantMessage,
      existingConsultations: state.savoirConsulted ?? [],
    });
    state = { ...state, savoirConsulted: savoir.savoirConsulted };

    const payloadBase = {
      mode: params.mode,
      messageInterlocuteur: params.tenantMessage,
      livingBuildingState: state,
      interlocuteur: formatTenantSocialLandscapeBlock(params.tenantSocial ?? null),
      prisme: buildRolePrismBrief(face),
    };

    const enqueteurPayload = JSON.stringify(
      { ...payloadBase, perceptionMetier: savoir.enqueteurPerception, protectionSociale: protectionBrief || null },
      null,
      2,
    );
    const archivistePayload = JSON.stringify(
      { ...payloadBase, perceptionJuridique: savoir.archivistePerception, protectionSociale: protectionBrief || null },
      null,
      2,
    );
    const majordomePayload = JSON.stringify(payloadBase, null, 2);

    const [enqRaw, archRaw, majFactsRaw] = await Promise.all([
      this.host.chatStructured(buildEnqueteurSystemPrompt(), enqueteurPayload, 900, {
        json: true,
        timeoutMs: 14_000,
        model: GROQ_MODEL_ENQUETEUR,
      }),
      this.host.chatStructured(buildArchivisteSystemPrompt(), archivistePayload, 600, {
        json: true,
        timeoutMs: 12_000,
        model: GROQ_MODEL_ARCHIVISTE,
      }),
      this.host.chatStructured(buildMajordomeFactsSystemPrompt(), majordomePayload, 500, {
        json: true,
        timeoutMs: 14_000,
        model: GROQ_MODEL_MAJORDOME,
      }),
    ]);

    const enq = llmJson(enqRaw);
    const arch = llmJson(archRaw);
    const majF = llmJson(majFactsRaw);

    const echoes: LivingDeliberationEcho[] = [];
    if (enq?.insight) {
      echoes.push({
        agent: 'enqueteur',
        model: GROQ_MODEL_ENQUETEUR,
        insight: asString(enq.insight),
        at: new Date().toISOString(),
      });
    }
    if (arch?.insight) {
      echoes.push({
        agent: 'archiviste',
        model: GROQ_MODEL_ARCHIVISTE,
        insight: asString(arch.insight),
        at: new Date().toISOString(),
      });
    }
    if (majF?.insight) {
      echoes.push({
        agent: 'majordome',
        model: GROQ_MODEL_MAJORDOME,
        insight: asString(majF.insight),
        at: new Date().toISOString(),
      });
    }

    state = mergeLivingPatches(
      state,
      { enqueteur: enq, archiviste: arch, majordome: majF },
      echoes,
      params.tenantSocial,
    );

    const instruments = buildInstrumentsBoard(state, echoes, {
      enqueteur: enq,
      archiviste: arch,
      majordome: majF,
    });

    state = {
      ...state,
      symmetricDeliberation: {
        level: SYMMETRIC_LEVEL,
        interlocutorFace: face,
        instrumentsBoard: instruments,
        expertReports: {
          enqueteur: enq,
          archiviste: arch,
          majordomeFacts: majF,
        },
        contradictionActive: contradiction.shouldChallenge,
        contradictionNote: contradiction.challengeBrief,
        doctrineVersion: `symmetric-${SYMMETRIC_LEVEL}`,
      },
    };

    const safetyLock = isLivingSafetyLockActive(state);
    const expertHandoff = state.consciousness?.expertHandoffRequired === true;

    const speakSystem = buildMajordomeSpeakSystemPrompt({
      creolePreferred: state.humanBarrier.creolePreferred,
      language: state.language,
      mode: params.mode,
      rolePrismBrief: buildRolePrismBrief(face),
      instrumentsBrief: instruments.pilotBrief,
      contradictionBrief: contradiction.politeChallengeFr,
    });

    const speakPayload = [
      speakSystem,
      formatTenantSocialLandscapeBlock(params.tenantSocial ?? null),
      buildMajordomeConsciousnessBrief(state),
      safetyLock ? LIVING_SAFETY_LOCK_MAJORDOME : '',
      expertHandoff ? `Handoff : « ${JARVIS_EXPERT_HANDOFF_FR} »` : '',
      state.intervention.readyForDispatch && !expertHandoff
        ? 'Annoncez la transmission au technicien avec clarté.'
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const speakRaw = await this.host.chatStructured(
      speakPayload,
      JSON.stringify(
        {
          instrumentsDeBord: instruments,
          livingBuildingState: state,
          safetyLockActive: safetyLock,
        },
        null,
        2,
      ),
      700,
      { json: false, timeoutMs: 14_000, model: GROQ_MODEL_MAJORDOME },
    );

    let tenantMessage =
      cleanNaturalParole(speakRaw) ||
      this.fallbackSpeak(state.humanBarrier.displayName, state, safetyLock, params.mode);

    if (safetyLock && !/disjoncteur|coupez|éloign|eloign|coup/i.test(tenantMessage)) {
      tenantMessage = this.fallbackSpeak(state.humanBarrier.displayName, state, true, params.mode);
      this.logger.warn('Majordome — verrou sécurité, parole de secours');
    }

    if (!cleanNaturalParole(speakRaw)) {
      this.logger.warn(`Majordome speak — parole de secours (mode=${params.mode}, face=${face})`);
    }

    tenantMessage = sanitizeTenantMessageForVulnerability(tenantMessage, state);

    if (expertHandoff && !/expert|technicien|référent|referent|complexe/i.test(tenantMessage)) {
      const name = state.humanBarrier.displayName || 'Marie';
      tenantMessage = `${name}, je vous accompagne avec certitude : ${JARVIS_EXPERT_HANDOFF_FR}`;
    }

    const intakeComplete =
      state.readiness === 'READY_FOR_TECHNICIAN' || expertHandoff;

    return {
      livingState: {
        ...state,
        safetyLock: {
          ...state.safetyLock,
          consigneGiven:
            state.safetyLock.consigneGiven ||
            /disjoncteur|coupez|éloign/.test(tenantMessage),
        },
        updatedAt: new Date().toISOString(),
      },
      tenantMessage,
      intakeComplete,
      handoffRequired: intakeComplete,
      handoffReason: expertHandoff
        ? state.consciousness.expertHandoffReason
        : intakeComplete
          ? 'Dossier qualifié pour technicien secteur'
          : null,
    };
  }

  private fallbackSpeak(
    name: string,
    state: LivingBuildingState,
    safetyLock: boolean,
    mode: 'opening' | 'tenant_turn',
  ): string {
    if (safetyLock) {
      if (state.tenantProfile?.isVulnerable) {
        return `${name}, éloignez-vous tout de suite — ne touchez à rien, je fais intervenir le technicien en urgence.`;
      }
      return `${name}, éloignez-vous tout de suite — coupez le disjoncteur si vous pouvez sans danger, puis dites-moi quand c’est fait.`;
    }

    if (mode === 'opening') {
      const sujet = state.signalementTitle?.trim() || 'votre signalement';
      return (
        `${name}, bonjour — j’ai bien reçu votre demande concernant ${sujet.toLowerCase()}. ` +
        `Mon équipe a consulté le logement ; je vous accompagne avec clarté et douceur.`
      );
    }

    if (state.lastTenantMessage?.trim()) {
      return (
        `${name}, je retiens bien ce que vous me dites — merci. ` +
        `Je poursuis l’échange avec mon équipe et je vous guide pas à pas.`
      );
    }

    const signe = state.signalementTitle || 'votre situation';
    return `${name}, je suis avec vous sur ${signe.toLowerCase()} — parlons-en naturellement.`;
  }
}
