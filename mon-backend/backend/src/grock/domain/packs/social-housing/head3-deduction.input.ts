import type { PreprocessedSignal } from '../../../preprocessor/preprocessor.types';
import { buildSignalCorpus } from '../../../head-input/corpus.util';
import type { Head3DeductionInput } from '../../../domain/head-pack.contract';
import type { Head1AnalysisInput, Head2VerificationInput } from '../../../head-input/head-input.types';
import { computeHead3HypothesisScores } from './head3-scores.util';

const NEIGHBOR =
  /voisin|voisine|dessus|au[- ]dessus|étage au[- ]dessus|etage au[- ]dessus|logement du dessus|appartement du dessus|du dessus/i;

/**
 * Tête 3 — hypothèses pondérées (scores), sans state sinistre.
 */
export function buildHead3DeductionInput(
  signal: PreprocessedSignal,
  head1: Head1AnalysisInput,
  _head2: Head2VerificationInput,
): Head3DeductionInput {
  const corpus = buildSignalCorpus(signal);
  const triggers: string[] = [];
  const neighbor = NEIGHBOR.test(corpus);
  const originFromAbove = head1.ceilingSignal;

  const scores = computeHead3HypothesisScores(
    corpus,
    head1,
    Boolean(signal.visualPerceptionRaw?.trim()),
  );

  const originCandidates: string[] = [];
  if (originFromAbove) {
    triggers.push('origine au-dessus (physique plafond)');
    originCandidates.push('logement du dessus (voisin)');
    originCandidates.push('toiture / façade / parties communes (bailleur)');
  }
  if (neighbor) {
    triggers.push('voisin mentionné');
    originCandidates.push('origine voisine explicite');
  }
  if (scores.condensation_score >= 5) originCandidates.push('condensation / usage (à discriminer)');
  if (!originCandidates.length && head1.waterSignal) {
    originCandidates.push('origine à qualifier — UNE question discriminante');
  }
  if (scores.sinistre_probable) triggers.push('sinistre probable (hypothèse, pas verdict)');

  return {
    ...scores,
    originFromAbove,
    neighborInvolved: neighbor,
    originCandidates,
    triggers,
  };
}

export function renderHead3PromptBlock(input: Head3DeductionInput): string {
  const lines = [
    '--- Tête 3 · DÉDUCTION — hypothèses pondérées (pas de verdict) ---',
    `infiltration_score : ${input.infiltration_score}/10`,
    `origine_voisin_score : ${input.origine_voisin_score}/10`,
    `origine_toiture_score : ${input.origine_toiture_score}/10`,
    `degat_des_eaux_score : ${input.degat_des_eaux_score}/10`,
    `condensation_score : ${input.condensation_score}/10`,
    `sinistre_probable (hypothèse) : ${input.sinistre_probable ? 'oui' : 'non'}`,
  ];
  if (input.originCandidates.length) {
    lines.push(`Origines candidates : ${input.originCandidates.join(' ; ')}.`);
  }
  if (input.originFromAbove) {
    lines.push(
      'Fondamental : eau au plafond = origine au-dessus — voisin OU patrimoine bailleur (toiture, parties communes).',
    );
  }
  lines.push('Ne tranche pas state ici — transmet hypothèses ordonnées à la Tête 4.');
  return lines.join('\n');
}
