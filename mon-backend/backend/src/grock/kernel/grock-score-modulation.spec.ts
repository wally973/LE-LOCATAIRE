import {
  applyScoreModulation,
  enforceScoreCoherence,
  filterScoresForSurface,
  inferDecisionModality,
  isDangerCommunicationIncoherent,
  isInferenceDecisionIncoherent,
  modulateDecisionState,
  scoreDoctrineTriggers,
  softenAlarmistAcknowledgment,
  targetCommunicationBand,
} from './grock-score-modulation';
import { SCORE_MODULATION_FIXTURES } from './grock-score-modulation.fixtures';

describe('grock-score-modulation', () => {
  it('mappe dangerLevel vers bandes communicationIntensity', () => {
    expect(targetCommunicationBand(2)).toEqual({ min: 1, max: 3 });
    expect(targetCommunicationBand(5)).toEqual({ min: 4, max: 6 });
    expect(targetCommunicationBand(9)).toEqual({ min: 7, max: 10 });
  });

  it('corrige communicationIntensity hors bande', () => {
    const scores = enforceScoreCoherence({
      dangerLevel: 3,
      communicationIntensity: 8,
    });
    expect(scores.communicationIntensity).toBeLessThanOrEqual(3);
    expect(isDangerCommunicationIncoherent(scores)).toBe(false);
  });

  it('atténue alarmisme si dangerLevel bas', () => {
    const soft = softenAlarmistAcknowledgment(
      'Quittez le logement. Appelez le 112. Sécurisez la prise.',
      3,
    );
    expect(soft).not.toMatch(/112|quittez/i);
    expect(soft.toLowerCase()).toContain('sécurisez');
  });

  it('modulateDecisionState prudent si inferenceConfidence faible', () => {
    expect(
      modulateDecisionState('bailleur_responsable', {
        inferenceConfidence: 2,
        decisionConfidence: 2,
        signalQuality: 3,
      }),
    ).toBe('NEED_PHOTO');
  });

  it('détecte incohérence inference faible + décision ferme', () => {
    expect(
      isInferenceDecisionIncoherent(
        { inferenceConfidence: 2 },
        'bailleur_responsable',
      ),
    ).toBe(true);
  });

  it('filtre scores par surface locataire / technicien / bailleur / admin', () => {
    const full = {
      signalQuality: 6,
      dangerLevel: 3,
      factExtractionConfidence: 7,
      inferenceConfidence: 5,
      decisionConfidence: 4,
      communicationIntensity: 2,
    };
    expect(filterScoresForSurface(full, 'tenant')).toBeNull();
    expect(filterScoresForSurface(full, 'technician')).toEqual({
      signalQuality: 6,
      dangerLevel: 3,
      factExtractionConfidence: 7,
    });
    expect(filterScoresForSurface(full, 'landlord')).toEqual({
      signalQuality: 6,
      inferenceConfidence: 5,
      decisionConfidence: 4,
    });
    expect(filterScoresForSurface(full, 'admin')).toEqual(full);
  });

  it('produit des déclencheurs doctrine', () => {
    const triggers = scoreDoctrineTriggers({
      signalQuality: 2,
      inferenceConfidence: 2,
      decisionConfidence: 2,
      dangerLevel: 2,
      communicationIntensity: 7,
    });
    expect(triggers.some((t) => t.includes('signalQuality'))).toBe(true);
    expect(triggers.some((t) => t.includes('prudence'))).toBe(true);
  });

  describe('fixtures non-régression', () => {
    for (const fx of SCORE_MODULATION_FIXTURES) {
      it(`cohérence ${fx.id}`, () => {
        const modulated = applyScoreModulation({
          scores: fx.scores,
          state: fx.state as never,
          acknowledgment: fx.acknowledgment,
          thinking: 'Analyse interne.',
        });

        const [min, max] = fx.expectIntensityBand;
        expect(modulated.scores.communicationIntensity).toBeGreaterThanOrEqual(min);
        expect(modulated.scores.communicationIntensity).toBeLessThanOrEqual(max);

        if (fx.expectAlarmSoftened) {
          expect(modulated.acknowledgment).not.toMatch(/112|quittez/i);
        }

        if (fx.expectPrudentState) {
          expect(['ASK_ONE_QUESTION', 'NEED_PHOTO']).toContain(modulated.state);
        }

        expect(modulated.thinking).toContain('[SCORES]');
      });
    }
  });

  it('modalité décision selon inferenceConfidence', () => {
    expect(inferDecisionModality(2)).toBe('prudent');
    expect(inferDecisionModality(5)).toBe('normal');
    expect(inferDecisionModality(9)).toBe('ferme');
  });
});
