/**
 * Délibération Tabula Rasa — trois phrases brutes + bibliothèque AFPOL/Loi, sans brief pré-mâché.
 */
import { Injectable, Logger } from '@nestjs/common';
import { LiaHostService } from '../conversation/lia-host.service';
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
import { prepareTabulaRasaSavoir } from './living-tabula-savoir';
import {
  buildTabulaRasaAgentPayload,
  resolveTabulaRasaPhrases,
} from './living-tabula-rasa';
import { buildInstrumentsBoard } from './living-instruments-board';
import { resolveInterlocutorFace } from './living-role-prism';
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
    let state: LivingBuildingState = bumpStateToSymmetricLevel6(
      {
        ...params.state,
        lastTenantMessage: params.tenantMessage.trim() || null,
        readiness: 'DELIBERATING',
        updatedAt: new Date().toISOString(),
      },
      face,
    );

    const troisPhrases = resolveTabulaRasaPhrases({
      mode: params.mode,
      message: params.tenantMessage,
      signalementDescription: state.signalementDescription,
    });

    const savoir = prepareTabulaRasaSavoir();
    state = { ...state, savoirConsulted: savoir.savoirConsulted };

    const agentPayload = buildTabulaRasaAgentPayload({
      troisPhrasesLocataire: troisPhrases,
      bibliothequeSavoir: savoir.bibliothequeSavoir,
    });

    const [enqRaw, archRaw, majFactsRaw] = await Promise.all([
      this.host.chatStructured(buildEnqueteurSystemPrompt(), agentPayload, 900, {
        json: true,
        timeoutMs: 14_000,
        model: GROQ_MODEL_ENQUETEUR,
      }),
      this.host.chatStructured(buildArchivisteSystemPrompt(), agentPayload, 600, {
        json: true,
        timeoutMs: 12_000,
        model: GROQ_MODEL_ARCHIVISTE,
      }),
      this.host.chatStructured(buildMajordomeFactsSystemPrompt(), agentPayload, 500, {
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
      state.signalementTitle,
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
        contradictionActive: false,
        contradictionNote: null,
        doctrineVersion: `tabula-rasa-${SYMMETRIC_LEVEL}`,
      },
    };

    const expertHandoff = state.consciousness?.expertHandoffRequired === true;

    const speakSystem = buildMajordomeSpeakSystemPrompt({
      creolePreferred: state.humanBarrier.creolePreferred,
      language: state.language,
      mode: params.mode,
    });

    const speakPayload = JSON.stringify(
      {
        troisPhrasesLocataire: troisPhrases,
        rapportsExperts: {
          enqueteur: enq,
          archiviste: arch,
          majordomeFacts: majF,
        },
        prenomLocataire: state.humanBarrier.displayName,
      },
      null,
      2,
    );

    const speakRaw = await this.host.chatStructured(
      speakSystem,
      speakPayload,
      700,
      { json: false, timeoutMs: 14_000, model: GROQ_MODEL_MAJORDOME },
    );

    let tenantMessage =
      cleanNaturalParole(speakRaw) ||
      this.fallbackSpeak(state.humanBarrier.displayName, state, params.mode);

    if (!cleanNaturalParole(speakRaw)) {
      this.logger.warn(`Majordome speak — parole de secours (mode=${params.mode}, face=${face})`);
    }

    const intakeComplete =
      state.readiness === 'READY_FOR_TECHNICIAN' || expertHandoff;

    return {
      livingState: {
        ...state,
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
    mode: 'opening' | 'tenant_turn',
  ): string {
    if (mode === 'opening') {
      const sujet = state.signalementTitle?.trim() || 'votre signalement';
      return `${name}, bonjour — j’ai bien reçu votre demande concernant ${sujet.toLowerCase()}. Comment puis-je vous aider ?`;
    }

    if (state.lastTenantMessage?.trim()) {
      return `${name}, je vous écoute — merci pour ce que vous venez de me dire.`;
    }

    const signe = state.signalementTitle || 'votre situation';
    return `${name}, je suis avec vous sur ${signe.toLowerCase()}.`;
  }
}
