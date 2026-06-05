/**
 * Symétrie de l'expertise — Lia peut contredire poliment un diagnostic humain erroné.
 */
import type { LivingBuildingState } from './living-building-state.types';

export interface SymmetricContradictionResult {
  shouldChallenge: boolean;
  challengeBrief: string | null;
  politeChallengeFr: string | null;
  missingVisualLogic: string[];
}

const VISUAL_LOGIC_GAPS: Array<{
  id: string;
  label: string;
  humanSays: RegExp;
  stateRequires: (ctx: string, state: LivingBuildingState) => boolean;
  challenge: string;
}> = [
  {
    id: 'envelope_before_plumber',
    label: 'Enveloppe avant plomberie',
    humanSays: /plombier|joint|siphon|debouch|débouch/i,
    stateRequires: (ctx, s) =>
      /moisiss|infiltr|toit|plafond|enveloppe|étanchéit|etancheit|humid.*mur/.test(ctx) ||
      s.vision3d.mentalModels.some((m) => /enveloppe|dalle froide/i.test(m)) ||
      s.vision3d.activeFlows.some((f) => /étanchéit|enveloppe/i.test(f)),
    challenge:
      'Je vois votre hypothèse plomberie — avez-vous considéré l’enveloppe du bâtiment (toiture, façade, pont thermique) comme source d’humidité ?',
  },
  {
    id: 'cold_slab_below',
    label: 'Dalle froide commerce sous logement',
    humanSays: /simple|locatif|joint robinet|ampoule/i,
    stateRequires: (ctx, s) =>
      /commerce|pharmacie|local commercial|rdc|r-1|dalle froide|condensation/.test(ctx) ||
      s.vision3d.below?.toLowerCase().includes('commerce') ||
      s.vision3d.mentalModels.some((m) => /dalle froide/i.test(m)),
    challenge:
      'Avez-vous envisagé le pont thermique du local commercial en-dessous (dalle froide) avant de classer cela en menue réparation locative ?',
  },
  {
    id: 'exutoire_before_amont',
    label: 'Exutoire aval avant amont',
    humanSays: /remplacer|changer|robinet|flexible|évier/i,
    stateRequires: (ctx, s) =>
      /refoul|odeur egout|eau savonneuse|colonne|19h|soir/.test(ctx) ||
      s.vision3d.activeFlows.some((f) => /exutoire|refoul/i.test(f)),
    challenge:
      'Avant de viser l’amont, avez-vous vérifié l’exutoire aval (réseau collectif, refoulement aux heures de pointe) ?',
  },
];

/** Évalue une proposition diagnostic humaine (technicien / admin / Lia-Lab). */
export function evaluateSymmetricContradiction(
  state: LivingBuildingState,
  humanProposal: string,
): SymmetricContradictionResult {
  const proposal = humanProposal.trim();
  if (!proposal) {
    return {
      shouldChallenge: false,
      challengeBrief: null,
      politeChallengeFr: null,
      missingVisualLogic: [],
    };
  }

  const ctx = [
    state.signalementTitle,
    state.signalementDescription,
    state.lastTenantMessage,
    proposal,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const missing: string[] = [];
  const challenges: string[] = [];

  for (const rule of VISUAL_LOGIC_GAPS) {
    if (rule.humanSays.test(proposal) && rule.stateRequires(ctx, state)) {
      missing.push(rule.label);
      challenges.push(rule.challenge);
    }
  }

  if (challenges.length === 0) {
    return {
      shouldChallenge: false,
      challengeBrief: null,
      politeChallengeFr: null,
      missingVisualLogic: [],
    };
  }

  const polite = challenges[0];
  return {
    shouldChallenge: true,
    challengeBrief: `Contradiction symétrique — ${missing.join(', ')}`,
    politeChallengeFr: polite,
    missingVisualLogic: missing,
  };
}
