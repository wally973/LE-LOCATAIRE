/**
 * Tabula Rasa + NuclearFlush — Constitution N7.
 * Deux entrées agent : 3 phrases + bibliothèque brute. Armoire vidée à chaque session/tour.
 */
import { randomUUID } from 'crypto';
import type { CompanionLanguage } from '../conversation/lia-companion.types';
import type { LivingBuildingState } from './living-building-state.types';
import { createLivingBuildingState } from './living-building-state.factory';
import { createInitialSymmetricDeliberation } from './living-symmetric.factory';
import { createOpenDossierIntegrity } from './living-dossier-integrity';
import { LIVING_STATE_JARVIS_KEY } from './living-building-state.repository';
import { LIVING_TEAM_CHARTER_FR } from './living-team-roles';

/** Clés jarvisFacts V1 à purger à chaque flush. */
const JARVIS_GHOST_KEYS = [
  'trade_override',
  'charge_override',
  'organizer_panne',
  'extracted_plumbing',
  'extracted_electricity',
  'perception_metier',
  'perception_juridique',
  'legacy_step',
  'script_ack',
  'jarvis_summary',
  'jarvis_last_ack',
  'grock_conversation_fil',
  'objet_ancre',
  'zoneB_identifiee',
  'zoneB_envers',
  'zoneB_question_pour_lia',
  'ancrage_spatial',
  'element_focus',
  'verdict_projete',
] as const;

/** Préfixes jarvisFacts cognitifs — aucun fantôme inter-dossiers. */
const JARVIS_COGNITIVE_PREFIXES = [
  'extracted_',
  'perception_',
  'zoneB_',
  'ancrage_',
  'element_',
  'verdict_',
  'organizer_',
  'script_',
  'legacy_',
] as const;

/** Extrait les trois dernières phrases du texte locataire. */
export function extractThreeSentences(raw: string): string[] {
  const text = raw.trim();
  if (!text) return [];

  const parts = text
    .split(/(?<=[.!?…])\s+|\n+/u)
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length <= 3) return parts;
  return parts.slice(-3);
}

/** Texte source pour l’ouverture (description signalement) ou le tour courant. */
export function resolveTabulaRasaPhrases(params: {
  mode: 'opening' | 'tenant_turn';
  message: string;
  signalementDescription: string;
}): string[] {
  if (params.mode === 'tenant_turn' && params.message.trim()) {
    return extractThreeSentences(params.message);
  }
  const opening = params.signalementDescription.trim();
  return extractThreeSentences(opening);
}

/** Re-lie le signalement courant (titre + description du ticket / session). */
export function rebindSignalement(
  state: LivingBuildingState,
  title: string,
  description: string,
): LivingBuildingState {
  return {
    ...state,
    signalementTitle: title.trim(),
    signalementDescription: description.trim(),
  };
}

/** Purge physique des faits cognitifs sérialisés dans jarvisFacts. */
export function purgeJarvisCognitiveFacts(
  facts: Record<string, string> | undefined,
): Record<string, string> {
  if (!facts) return {};
  const out = { ...facts };
  delete out[LIVING_STATE_JARVIS_KEY];
  for (const key of JARVIS_GHOST_KEYS) {
    delete out[key];
  }
  for (const key of Object.keys(out)) {
    if (JARVIS_COGNITIVE_PREFIXES.some((p) => key.startsWith(p))) {
      delete out[key];
    }
  }
  return out;
}

function normScope(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/**
 * Détecte des fantômes mémoire après NuclearFlush — avant délibération Paul/Pierre.
 */
export function detectMemoryGhosts(params: {
  state: LivingBuildingState;
  title: string;
  description: string;
  jarvisFacts?: Record<string, string>;
}): string[] {
  const ghosts: string[] = [];
  const scope = normScope(`${params.title} ${params.description}`);

  if (params.jarvisFacts) {
    for (const key of Object.keys(params.jarvisFacts)) {
      if (key === LIVING_STATE_JARVIS_KEY || key === 'reasoning_source') continue;
      if ((JARVIS_GHOST_KEYS as readonly string[]).includes(key)) {
        ghosts.push(`jarvisFacts.${key}`);
      }
      if (JARVIS_COGNITIVE_PREFIXES.some((p) => key.startsWith(p))) {
        ghosts.push(`jarvisFacts.${key}`);
      }
    }
  }

  const reports = params.state.symmetricDeliberation?.expertReports;
  if (reports?.enqueteur || reports?.archiviste || reports?.liaScenographe) {
    ghosts.push('expertReports résiduels');
  }

  if (params.state.deliberationEchoes.length > 0) {
    ghosts.push('deliberationEchoes résiduels');
  }

  if (params.state.legalVerdict.summary?.trim()) {
    ghosts.push(`legalVerdict.summary=${params.state.legalVerdict.summary.slice(0, 40)}`);
  }

  if (Object.keys(params.state.humanBarrier.extractedFacts).length > 0) {
    ghosts.push('humanBarrier.extractedFacts non vide');
  }

  const element = params.state.vision3d.element?.trim().toLowerCase();
  if (element) {
    const moistureScope = /moi|humid|mur|plafond|salp|infiltr/.test(scope);
    const tileScope = /carrel|carreau|sol/.test(scope);
    const tileElement = /carrel|carreau/.test(element);
    const moistureElement = /mur|plafond|moisi|humid/.test(element);
    if (moistureScope && tileElement && !tileScope) {
      ghosts.push(`vision3d.element=${element} (hors sujet moisissure/humidité)`);
    }
    if (tileScope && moistureElement && !moistureScope) {
      ghosts.push(`vision3d.element=${element} (hors sujet carrelage/sol)`);
    }
  }

  return ghosts;
}

/**
 * Table vierge — nouvelle conversation / ouverture.
 * Aucun héritage d’ancrage, élément ou verdict d’un dossier précédent.
 */
export function forgePristineLivingState(params: {
  title: string;
  description: string;
  language: CompanionLanguage;
  tenantFirstName?: string;
  ageBand?: 'senior' | 'adult' | 'young' | 'unknown';
  livesAlone?: boolean;
  creolePreferred?: boolean;
  interlocutorFace?: 'locataire' | 'technicien' | 'bailleur' | 'equipe_test';
}): LivingBuildingState {
  const face = params.interlocutorFace ?? 'locataire';
  const draft = createLivingBuildingState({
    title: params.title,
    description: params.description,
    language: params.language,
    tenantFirstName: params.tenantFirstName,
    ageBand: params.ageBand,
    livesAlone: params.livesAlone,
    creolePreferred: params.creolePreferred,
  });
  return rebindSignalement(
    nuclearFlushLivingState({
      ...draft,
      stateInstanceId: randomUUID(),
      guardianReview: null,
      doctrinePending: [],
      symmetricDeliberation: createInitialSymmetricDeliberation(face),
    }),
    params.title,
    params.description,
  );
}

/** Vide la mémoire cognitive — redécouverte du bâtiment. */
export function wipeLivingCognitiveState(state: LivingBuildingState): LivingBuildingState {
  const face = state.symmetricDeliberation?.interlocutorFace ?? 'locataire';
  return {
    ...state,
    updatedAt: new Date().toISOString(),
    readiness: 'OPENING',
    tenantProfile: { isVulnerable: false, reason: 'Tabula rasa — profil lu par les agents' },
    consciousness: {
      socialProtectionOverride: false,
      socialProtectionNote: null,
      constructiveDoubt: false,
      competingModels: [],
      internalNote: null,
      expertHandoffRequired: false,
      expertHandoffReason: null,
    },
    vision3d: {
      floorLevel: null,
      rooms: [],
      element: null,
      symptomAnchor: null,
      above: null,
      below: null,
      climate: 'tropical_humid',
      activeFlows: [],
      mentalModels: [],
      hypotheses: [],
    },
    safetyLock: {
      severityZone: 'DAWN',
      hazardType: 'none',
      requiresPowerCutoff: false,
      requiresWaterShutoff: false,
      safetyVerified: false,
      consigneGiven: false,
      verifiedAt: null,
    },
    legalVerdict: {
      chargeHorizon: 'INDETERMINE',
      articles: [],
      facts: [],
      summary: null,
      tenantChargeExplanation: null,
      afpolGrounding: null,
    },
    intervention: {
      tradeNeeded: null,
      partsToBring: [],
      toolsRequired: [],
      urgencyLabel: 'STANDARD',
      technicianSummary: null,
      readyForDispatch: false,
    },
    deliberationRound: 0,
    deliberationEchoes: [],
    savoirConsulted: [],
    dossierIntegrity: createOpenDossierIntegrity(),
    teamSymbiosis: {
      charter: LIVING_TEAM_CHARTER_FR,
      agents: [],
      updatedAt: new Date().toISOString(),
    },
    symmetricDeliberation: createInitialSymmetricDeliberation(face),
    guardianReview: null,
    cyberGardienAudit: null,
    doctrinePending: [],
    lastTenantMessage: null,
  };
}

/**
 * NuclearFlush N7 — armoire vidée, fantômes V1 exclus.
 * Appelé à chaque nouvelle session et avant chaque tour de délibération.
 */
export function nuclearFlushLivingState(state: LivingBuildingState): LivingBuildingState {
  const flushed = wipeLivingCognitiveState(state);
  return {
    ...flushed,
    humanBarrier: {
      ...flushed.humanBarrier,
      extractedFacts: {},
      vulnerabilityNotes: null,
      relationalTone: null,
    },
    reasoningSource: 'living_intelligence',
  };
}

/** Alias canonique Constitution. */
export const nuclearFlush = nuclearFlushLivingState;

/** Purge les clés legacy + état Living sérialisé dans jarvisFacts (intake). */
export function nuclearFlushJarvisFacts(
  facts: Record<string, string> | undefined,
): Record<string, string> {
  return purgeJarvisCognitiveFacts(facts);
}

export function buildTabulaRasaAgentPayload(params: {
  troisPhrasesLocataire: string[];
  bibliothequeSavoir: unknown;
}): string {
  return JSON.stringify(
    {
      troisPhrasesLocataire: params.troisPhrasesLocataire,
      bibliothequeSavoir: params.bibliothequeSavoir,
    },
    null,
    2,
  );
}
