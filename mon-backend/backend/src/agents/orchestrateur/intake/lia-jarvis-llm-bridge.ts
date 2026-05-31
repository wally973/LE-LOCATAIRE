/**
 * Pont LLM Jarvis — chaque message Marie passe par Groq APRÈS brief équipe (Archiviste + Diagnostiqueur).
 */
import { Injectable, Logger } from '@nestjs/common';
import { LiaHostService } from '../conversation/lia-host.service';
import { normalizeCompanionLanguage } from '../../shared/lia-dialogue-languages';
import type { CompanionLanguage } from '../conversation/lia-companion.types';
import {
  loadMissionJarvisBrief,
  loadVisualLogicBrief,
} from './lia-jarvis-visual-logic';
import type {
  JarvisFlowKind,
  JarvisSimulationDomain,
  JarvisSimulationState,
  PhysicalHypothesis,
} from './lia-jarvis-simulation.engine';
import { isJarvisLlmBridgeEnabled } from './lia-jarvis-bridge.config';
import { LiaJarvisTeamBriefService } from './lia-jarvis-team-brief.service';
import {
  teamBriefToJarvisFacts,
  type JarvisTeamBrief,
} from './lia-jarvis-team-brief';
import { serializeCouncilRound } from './lia-jarvis-council.engine';
import { inferHousingPerspective } from './lia-housing-perspective';

export { isJarvisLlmBridgeEnabled };

export interface JarvisLlmBridgeScene3d {
  floorLevel?: string | null;
  room?: string | null;
  above?: string | null;
  below?: string | null;
  element?: string | null;
  symptomAnchor?: string | null;
}

export interface JarvisLlmBridgePayload {
  language?: string;
  domain?: string;
  mentalModels?: string[];
  physicalFlows?: string[];
  scene3d?: JarvisLlmBridgeScene3d;
  hypotheses?: Array<{
    id?: string;
    label?: string;
    visualization?: string;
    active?: boolean;
    confidence?: number;
  }>;
  visualizationSummary?: string;
  acknowledgment?: string;
  nextQuestion?: string | null;
  intakeComplete?: boolean;
  handoffRequired?: boolean;
  handoffReason?: string;
  extractedFacts?: Record<string, string>;
}

export interface JarvisLlmBridgeResult {
  simulation: JarvisSimulationState;
  acknowledgment: string;
  nextQuestion: string | null;
  intakeComplete: boolean;
  handoffRequired: boolean;
  handoffReason?: string;
  visualizationNote: string;
  extractedFacts: Record<string, string>;
  teamBrief: JarvisTeamBrief;
  teamFacts: Record<string, string>;
  councilSerialized: string;
}

const BRIDGE_SYSTEM = [
  'Tu es Lia — Agent Jarvis (Double Numérique de l’expert terrain) pour le logement social en Guyane.',
  'Tu ne parles PAS seule : l’Archiviste (loi) et le Diagnostiqueur (master-diagnostic-rules) te transmettent un BRIEF ÉQUIPE avant chaque réponse.',
  'Tu VISUALISES le bâtiment en 3D et simules les flux physiques AVANT de parler.',
  'Expertise d’abord : dis la vérité technique et juridique — pas de promesse pour faire plaisir.',
  '',
  '--- MISSION JARVIS ---',
].join('\n');

const BRIDGE_JSON_RULES = [
  '',
  '--- VISUAL_LOGIC ---',
  '',
  'Réponds en JSON uniquement avec ce schéma exact :',
  '{',
  '  "language": "fr" | "gcf" | "en" | "pt" | "es" | "hat",',
  '  "domain": "plumbing_sink" | "carpentry_door" | "roof_envelope" | "electricity" | "generic",',
  '  "mentalModels": ["Exutoire (3 verres): …", "Dalle froide: …", "Enveloppe: …"],',
  '  "physicalFlows": ["eau","air","chaleur","électricité","mécanique","étanchéité"],',
  '  "scene3d": { "floorLevel", "room", "above", "below", "element", "symptomAnchor" },',
  '  "hypotheses": [{ "id", "label", "visualization", "active", "confidence" }],',
  '  "visualizationSummary": "Ce que je visualise en 1 phrase technique",',
  '  "acknowledgment": "Réponse empathique au locataire — respecte les contraintes du BRIEF ÉQUIPE",',
  '  "nextQuestion": "une seule question discriminante OU null si dossier complet",',
  '  "intakeComplete": boolean,',
  '  "handoffRequired": boolean,',
  '  "handoffReason": "si handoff",',
  '  "extractedFacts": { "cle": "valeur" }',
  '}',
  '',
  'Protocole : extraction 360° dès le premier message ; ne JAMAIS redemander ce qui est déjà dit.',
  'Obéissance au BRIEF ÉQUIPE : si charge LOCATAIRE, ne promets pas technicien bailleur gratuit.',
  'Ne PAS inventer de flux physiques (eau, étanchéité) si le locataire ne les mentionne pas.',
  'Si trop contradictoire → handoffRequired true.',
].join('\n');

function buildBridgeSystemPrompt(teamBrief: JarvisTeamBrief): string {
  return [
    BRIDGE_SYSTEM,
    loadMissionJarvisBrief(),
    teamBrief.promptBlock,
    BRIDGE_JSON_RULES,
    loadVisualLogicBrief(),
  ].join('\n\n');
}

const FLOW_MAP: Record<string, JarvisFlowKind> = {
  eau: 'eau',
  air: 'air',
  chaleur: 'chaleur',
  chaleur_hvac: 'chaleur',
  electricite: 'signal',
  mecanique: 'mécanique',
  etancheite: 'étanchéité',
  signal: 'signal',
};

const DOMAIN_SET = new Set<string>([
  'plumbing_sink',
  'carpentry_door',
  'roof_envelope',
  'electricity',
  'generic',
]);

function normalizeDomain(raw?: string): JarvisSimulationDomain {
  const d = llmText(raw) || 'generic';
  return DOMAIN_SET.has(d) ? (d as JarvisSimulationDomain) : 'generic';
}

function llmText(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function llmOptionalText(value: unknown): string | null {
  const t = llmText(value);
  return t || null;
}

function normalizeFlows(raw?: unknown[]): JarvisFlowKind[] {
  if (!raw?.length) return ['signal'];
  const out: JarvisFlowKind[] = [];
  for (const f of raw) {
    const key = llmText(f).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    if (!key) continue;
    const mapped = FLOW_MAP[key];
    if (mapped && !out.includes(mapped)) out.push(mapped);
  }
  return out.length ? out : ['signal'];
}

function normalizeHypotheses(
  raw: JarvisLlmBridgePayload['hypotheses'],
): PhysicalHypothesis[] {
  if (!raw?.length) {
    return [
      {
        id: 'llm_observe',
        label: 'Observation terrain',
        visualization: 'Visualisation LLM — à confirmer sur site.',
        active: true,
        confidence: 0.5,
      },
    ];
  }
  return raw.map((h, i) => {
    const label = llmText(h?.label) || 'Hypothèse simulée';
    return {
      id: llmText(h?.id) || `llm_hypo_${i}`,
      label,
      visualization: llmText(h?.visualization) || label,
      active: h?.active !== false,
      confidence:
        typeof h?.confidence === 'number'
          ? Math.min(1, Math.max(0, h.confidence))
          : 0.7,
    };
  });
}

/** Parse et normalise la réponse Groq (testable sans appel réseau). */
export function parseJarvisLlmBridgePayload(
  raw: string,
  params: {
    language: CompanionLanguage;
    prior?: JarvisSimulationState | null;
  },
): Omit<JarvisLlmBridgeResult, 'teamBrief' | 'teamFacts' | 'councilSerialized'> | null {
  let parsed: JarvisLlmBridgePayload;
  try {
    parsed = JSON.parse(raw) as JarvisLlmBridgePayload;
  } catch {
    return null;
  }

  const ack = llmText(parsed.acknowledgment);
  if (!ack) return null;

  const lang = parsed.language
    ? normalizeCompanionLanguage(llmText(parsed.language))
    : params.language;

  const scene = parsed.scene3d ?? {};
  const priorScene = params.prior?.scene;

  const simulation: JarvisSimulationState = {
    domain: normalizeDomain(llmText(parsed.domain)),
    language: lang,
    scene: {
      climate: priorScene?.climate ?? 'tropical_humid',
      floorLevel: llmOptionalText(scene.floorLevel) ?? priorScene?.floorLevel ?? null,
      room: llmOptionalText(scene.room) ?? priorScene?.room ?? null,
      above: llmOptionalText(scene.above) ?? priorScene?.above ?? null,
      below: llmOptionalText(scene.below) ?? priorScene?.below ?? null,
      element: llmOptionalText(scene.element) ?? priorScene?.element ?? null,
      symptomAnchor:
        llmOptionalText(scene.symptomAnchor) ?? priorScene?.symptomAnchor ?? null,
    },
    activeFlows: normalizeFlows(parsed.physicalFlows as unknown[] | undefined),
    mentalModels: Array.isArray(parsed.mentalModels)
      ? parsed.mentalModels.map((m) => llmText(m)).filter(Boolean)
      : params.prior?.mentalModels ?? [],
    hypotheses: normalizeHypotheses(parsed.hypotheses),
    resolvedSteps: params.prior?.resolvedSteps ?? [],
    intakeComplete: parsed.intakeComplete === true,
    visualizationSummary:
      llmText(parsed.visualizationSummary) ||
      llmText(parsed.mentalModels?.[0]) ||
      'Visualisation physique Jarvis (pont LLM).',
  };

  const nextQ = llmOptionalText(parsed.nextQuestion);
  const intakeComplete =
    parsed.intakeComplete === true || (parsed.handoffRequired === true && !nextQ);

  return {
    simulation,
    acknowledgment: ack,
    nextQuestion: intakeComplete ? null : nextQ,
    intakeComplete,
    handoffRequired: parsed.handoffRequired === true,
    handoffReason: llmOptionalText(parsed.handoffReason) ?? undefined,
    visualizationNote: simulation.visualizationSummary,
    extractedFacts: Object.fromEntries(
      Object.entries(parsed.extractedFacts ?? {}).map(([k, v]) => [k, llmText(v)]),
    ),
  };
}

@Injectable()
export class LiaJarvisLlmBridgeService {
  private readonly logger = new Logger(LiaJarvisLlmBridgeService.name);

  constructor(
    private readonly host: LiaHostService,
    private readonly teamBrief: LiaJarvisTeamBriefService,
  ) {}

  isEnabled(): boolean {
    return isJarvisLlmBridgeEnabled();
  }

  /** Visualise le message locataire via Groq — brief équipe d’abord. */
  async visualizeMessage(params: {
    mode: 'opening' | 'tenant_turn';
    title: string;
    description: string;
    message: string;
    tenantFirstName?: string;
    preferredLanguage?: string;
    prior?: JarvisSimulationState | null;
    priorAcknowledgment?: string;
  }): Promise<JarvisLlmBridgeResult | null> {
    if (!this.isEnabled()) return null;

    const language = normalizeCompanionLanguage(
      params.preferredLanguage ?? params.prior?.language ?? 'fr',
    );
    const name = params.tenantFirstName?.trim() || 'Marie';
    const signalement = [params.title, params.description].filter(Boolean).join(' — ');
    const tenantText = params.message.trim() || signalement;

    const brief = await this.teamBrief.build({
      title: params.title,
      description: params.description,
      message: tenantText,
    });

    const userPayload = {
      mode: params.mode,
      tenantFirstName: name,
      language,
      signalementInitial: signalement,
      messageLocataire: tenantText,
      teamBrief: {
        archivistCharge: brief.archivist.chargeHint,
        diagnosticianResponsibility: brief.diagnostician.responsibilityHint,
        constraints: brief.constraints,
      },
      tourPrecedent: params.prior
        ? {
            domain: params.prior.domain,
            visualizationSummary: params.prior.visualizationSummary,
            scene: params.prior.scene,
            mentalModels: params.prior.mentalModels,
            resolvedSteps: params.prior.resolvedSteps,
          }
        : null,
      derniereReponseLia: params.priorAcknowledgment ?? null,
    };

    const maxTokens = Number(process.env.JARVIS_LLM_BRIDGE_MAX_TOKENS ?? 900);
    const raw = await this.host.chatStructured(
      buildBridgeSystemPrompt(brief),
      JSON.stringify(userPayload, null, 2),
      maxTokens,
      { json: true, timeoutMs: Number(process.env.JARVIS_LLM_BRIDGE_TIMEOUT_MS ?? 10_000) },
    );

    if (!raw) {
      this.logger.warn('Pont LLM Jarvis — réponse Groq vide');
      return null;
    }

    try {
      const parsed = parseJarvisLlmBridgePayload(raw, {
        language,
        prior: params.prior,
      });
      if (!parsed) {
        this.logger.warn('Pont LLM Jarvis — JSON invalide ou acknowledgment manquant');
        return null;
      }
      const teamFacts = teamBriefToJarvisFacts(brief);
      const councilSerialized = serializeCouncilRound({
        at: new Date().toISOString(),
        message: tenantText,
        housing: inferHousingPerspective(null),
        echoes: brief.councilEchoes,
      });
      return {
        ...parsed,
        teamBrief: brief,
        teamFacts,
        councilSerialized,
      };
    } catch (e) {
      this.logger.error('Pont LLM Jarvis — erreur parse réponse Groq', e);
      return null;
    }
  }
}
