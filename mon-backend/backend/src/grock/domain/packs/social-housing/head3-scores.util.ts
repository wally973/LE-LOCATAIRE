import type { Head3HypothesisScores } from '../../../domain/head-pack.contract';
import type { Head1AnalysisInput } from '../../../head-input/head-input.types';

const CONDENSATION =
  /condensat|buée|buee|vitre|fenêtre|fenetre|linge|séch|sech|aération|aeration/i;
const TOITURE =
  /toitur|façade|facade|goutti[eè]re|partie[s]? commune|collectif|immeuble/i;
const ENTREPRISE = /entreprise|artisan|chantier|travaux/i;
const TIERS_EXTERIEUR = /rue|voirie|terrasse|jardin|extérieur|exterieur/i;

function clamp10(n: number): number {
  return Math.max(0, Math.min(10, Math.round(n * 10) / 10));
}

/**
 * Pondération Tête 3 — hypothèses numériques (0–10), sans décision sinistre.
 */
export function computeHead3HypothesisScores(
  corpus: string,
  head1: Head1AnalysisInput,
  hasPerception: boolean,
): Head3HypothesisScores {
  let infiltration_score = 0;
  let origine_voisin_score = 0;
  let origine_toiture_score = 0;
  let degat_des_eaux_score = 0;
  let condensation_score = 0;

  if (head1.waterSignal) degat_des_eaux_score += 3;
  if (head1.activeWater) degat_des_eaux_score += 2;
  if (head1.ceilingSignal) {
    infiltration_score += 4;
    degat_des_eaux_score += 2;
    origine_toiture_score += 2;
    origine_voisin_score += 2;
  }
  if (head1.humidityTraces) {
    infiltration_score += 2;
    degat_des_eaux_score += 1;
  }
  if (head1.hasPhoto && hasPerception) {
    infiltration_score += 1;
    degat_des_eaux_score += 1;
  }
  if (/voisin|dessus|au[- ]dessus|logement du dessus/i.test(corpus)) {
    origine_voisin_score += 5;
  }
  if (TOITURE.test(corpus) || head1.ceilingSignal) {
    origine_toiture_score += 4;
  }
  if (head1.symptomAnchor === 'plafond' && head1.activeWater) {
    infiltration_score += 2;
    origine_voisin_score += 2;
  }
  if (CONDENSATION.test(corpus) && !head1.activeWater) {
    condensation_score += 5;
  }
  if (head1.symptomAnchor === 'équipement sanitaire') {
    degat_des_eaux_score += 1;
    origine_voisin_score = Math.max(0, origine_voisin_score - 2);
  }
  if (ENTREPRISE.test(corpus)) origine_voisin_score = Math.max(origine_voisin_score, 3);
  if (TIERS_EXTERIEUR.test(corpus)) origine_voisin_score = Math.max(origine_voisin_score, 2);

  infiltration_score = clamp10(infiltration_score);
  origine_voisin_score = clamp10(origine_voisin_score);
  origine_toiture_score = clamp10(origine_toiture_score);
  degat_des_eaux_score = clamp10(degat_des_eaux_score);
  condensation_score = clamp10(condensation_score);

  const sinistre_probable =
    degat_des_eaux_score >= 6 &&
    infiltration_score >= 6 &&
    condensation_score < 5 &&
    (head1.activeWater || head1.humidityTraces);

  return {
    infiltration_score,
    origine_voisin_score,
    origine_toiture_score,
    degat_des_eaux_score,
    condensation_score,
    sinistre_probable,
  };
}
