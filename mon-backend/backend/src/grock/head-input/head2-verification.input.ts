import type { PreprocessedSignal } from '../preprocessor/preprocessor.types';
import { buildSignalCorpus } from './corpus.util';
import type { DangerFlag, Head1AnalysisInput, Head2VerificationInput } from './head-input.types';

/**
 * Tête 2 — danger gradué + cohérence texte ↔ image.
 */
export function buildHead2VerificationInput(
  signal: PreprocessedSignal,
  head1: Head1AnalysisInput,
): Head2VerificationInput {
  const corpus = buildSignalCorpus(signal);
  const perception = (signal.visualPerceptionRaw ?? '').toLowerCase();
  const dangerFlags: DangerFlag[] = [];
  const textImageGaps: string[] = [];
  const triggers: string[] = [];

  const electricalRisk = head1.luminaireNearby && head1.waterSignal;
  const perceptionAvailable = Boolean(signal.visualPerceptionRaw?.trim());

  if (electricalRisk) dangerFlags.push('eau_electricite_proximite');
  if (head1.waterSignal || head1.humidityTraces) dangerFlags.push('zone_humide');
  if (head1.activeWater) dangerFlags.push('ecoulement_actif');
  if (head1.hasPhoto && !perceptionAvailable) dangerFlags.push('photo_sans_perception');

  if (head1.ceilingSignal && perception && !/plafond|infiltr|humid|goutte/i.test(perception)) {
    textImageGaps.push('texte évoque plafond/infiltration — perception ne le confirme pas clairement');
    dangerFlags.push('texte_image_ecart');
  }
  if (head1.activeWater && perception && !/goutte|coule|humid|eau|écoul/i.test(perception)) {
    textImageGaps.push('écoulement actif déclaré — perception sans écoulement visible');
    if (!dangerFlags.includes('texte_image_ecart')) dangerFlags.push('texte_image_ecart');
  }

  if (electricalRisk) triggers.push('eau + électricité à proximité');
  if (textImageGaps.length) triggers.push(...textImageGaps);

  let indicativeDangerLevel = 2;
  if (electricalRisk) indicativeDangerLevel = 8;
  else if (head1.activeWater && head1.waterSignal) indicativeDangerLevel = 6;
  else if (head1.waterSignal) indicativeDangerLevel = 4;

  return {
    electricalRisk,
    indicativeDangerLevel,
    perceptionAvailable,
    dangerFlags,
    textImageGaps,
    triggers,
  };
}

export function renderHead2PromptBlock(
  input: Head2VerificationInput,
  head1: Head1AnalysisInput,
): string {
  const lines = [
    '--- Tête 2 · VÉRIFICATION — cohérence et danger ---',
    `Indice danger gradué (capteur) : ${input.indicativeDangerLevel}/10.`,
    `Drapeaux danger : ${input.dangerFlags.length ? input.dangerFlags.join(', ') : 'aucun'}.`,
  ];
  if (input.textImageGaps.length) {
    lines.push('Écarts texte ↔ image :');
    for (const gap of input.textImageGaps) lines.push(`  • ${gap}`);
  }
  if (input.electricalRisk) {
    lines.push('⚠ Sécurité électrique prioritaire avant toute autre consigne.');
  }
  if (head1.hasPhoto && input.perceptionAvailable) {
    lines.push('Recoupe texte locataire ↔ perception brute avant de conclure.');
  }
  lines.push('Score dangerLevel et realityCheckConfidence selon faits validés.');
  return lines.join('\n');
}
