import { computeHead3HypothesisScores } from './head3-scores.util';
import type { Head1AnalysisInput } from '../../../head-input/head-input.types';

function head1(overrides: Partial<Head1AnalysisInput> = {}): Head1AnalysisInput {
  return {
    waterSignal: true,
    activeWater: true,
    ceilingSignal: true,
    humidityTraces: true,
    luminaireNearby: false,
    hasPhoto: true,
    roomKnown: true,
    symptomAnchor: 'plafond',
    waterAspect: null,
    buildingFloor: null,
    triggers: [],
    ...overrides,
  };
}

describe('computeHead3HypothesisScores', () => {
  it('gouttes plafond → infiltration_score élevé et sinistre_probable', () => {
    const scores = computeHead3HypothesisScores(
      "j'ai des gouttes d'eau qui coule du plafond",
      head1(),
      true,
    );
    expect(scores.infiltration_score).toBeGreaterThanOrEqual(8);
    expect(scores.degat_des_eaux_score).toBeGreaterThanOrEqual(8);
    expect(scores.sinistre_probable).toBe(true);
    expect(scores.condensation_score).toBeLessThan(5);
  });

  it('voisin explicite → origine_voisin_score renforcé', () => {
    const scores = computeHead3HypothesisScores(
      'eau au plafond le voisin du dessus a une fuite',
      head1(),
      false,
    );
    expect(scores.origine_voisin_score).toBeGreaterThanOrEqual(5);
  });
});
