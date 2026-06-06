/**
 * Tabula Rasa + NuclearFlush — Constitution N7.
 * Deux entrées agent : 3 phrases + bibliothèque brute. Armoire vidée à chaque session/tour.
 */
import type { LivingBuildingState } from './living-building-state.types';
import { createInitialSymmetricDeliberation } from './living-symmetric.factory';
import { createOpenDossierIntegrity } from './living-dossier-integrity';
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

/** Vide la mémoire cognitive — redécouverte du bâtiment. */
export function wipeLivingCognitiveState(state: LivingBuildingState): LivingBuildingState {
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
    symmetricDeliberation: createInitialSymmetricDeliberation(
      state.symmetricDeliberation?.interlocutorFace ?? 'locataire',
    ),
    lastTenantMessage: state.lastTenantMessage,
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

/** Purge les clés legacy dans jarvisFacts (intake). */
export function nuclearFlushJarvisFacts(
  facts: Record<string, string> | undefined,
): Record<string, string> {
  if (!facts) return {};
  const out = { ...facts };
  for (const key of JARVIS_GHOST_KEYS) {
    delete out[key];
  }
  return out;
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
