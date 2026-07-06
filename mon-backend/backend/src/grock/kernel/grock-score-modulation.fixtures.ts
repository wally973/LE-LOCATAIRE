import type { GrockConfidenceScores } from './grock-confidence-scores';

/** Fixtures non-régression — modulation cognitive par scores. */
export const SCORE_MODULATION_FIXTURES: Array<{
  id: string;
  scores: GrockConfidenceScores;
  acknowledgment: string;
  state: string;
  expectIntensityBand: [number, number];
  expectAlarmSoftened?: boolean;
  expectPrudentState?: boolean;
}> = [
  {
    id: 'prise-arrachee-douce',
    scores: {
      signalQuality: 7,
      dangerLevel: 3,
      communicationIntensity: 2,
      inferenceConfidence: 6,
      decisionConfidence: 5,
      factExtractionConfidence: 7,
    },
    acknowledgment:
      'Sécurisez la prise et n’y touchez pas avant le passage de l’électricien.',
    state: 'ACTION_LOCATAIRE',
    expectIntensityBand: [1, 3],
  },
  {
    id: 'danger-faible-parole-forte',
    scores: {
      signalQuality: 6,
      dangerLevel: 2,
      communicationIntensity: 8,
      inferenceConfidence: 5,
    },
    acknowledgment: 'Quittez le logement et appelez le 112 immédiatement.',
    state: 'SAFETY',
    expectIntensityBand: [1, 3],
    expectAlarmSoftened: true,
  },
  {
    id: 'inference-faible-conclusion',
    scores: {
      signalQuality: 3,
      dangerLevel: 2,
      communicationIntensity: 2,
      inferenceConfidence: 2,
      decisionConfidence: 2,
    },
    acknowledgment: 'Pouvez-vous envoyer une photo de la zone concernée ?',
    state: 'bailleur_responsable',
    expectIntensityBand: [1, 3],
    expectPrudentState: true,
  },
  {
    id: 'urgence-reelle',
    scores: {
      signalQuality: 8,
      dangerLevel: 9,
      communicationIntensity: 8,
      inferenceConfidence: 8,
      decisionConfidence: 9,
    },
    acknowledgment:
      'Coupez le courant si vous le pouvez sans danger, éloignez-vous de la zone et appelez le 112.',
    state: 'SAFETY',
    expectIntensityBand: [7, 10],
  },
];
