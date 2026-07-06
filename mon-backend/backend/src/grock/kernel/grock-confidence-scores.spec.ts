import {
  clampScore,
  formatScoresForThinking,
  isDangerCommunicationIncoherent,
  mergeConfidenceScores,
  parseScoresFromGrockRaw,
} from './grock-confidence-scores';

describe('grock-confidence-scores', () => {
  it('parse les scores depuis le JSON Grock', () => {
    const raw = JSON.stringify({
      thinking: 'Analyse',
      scores: {
        factExtractionConfidence: 7,
        dangerLevel: 2,
        communicationIntensity: 2,
      },
      acknowledgment: 'Bonjour',
    });
    const s = parseScoresFromGrockRaw(raw);
    expect(s.factExtractionConfidence).toBe(7);
    expect(s.dangerLevel).toBe(2);
  });

  it('détecte incohérence danger faible vs communication alarmiste', () => {
    expect(
      isDangerCommunicationIncoherent({
        dangerLevel: 2,
        communicationIntensity: 7,
      }),
    ).toBe(true);
    expect(
      isDangerCommunicationIncoherent({
        dangerLevel: 2,
        communicationIntensity: 3,
      }),
    ).toBe(false);
  });

  it('formate les scores pour thinking', () => {
    const line = formatScoresForThinking(
      mergeConfidenceScores(6, { dangerLevel: 2, decisionConfidence: 5 }),
    );
    expect(line).toContain('[SCORES]');
    expect(line).toContain('signalQuality=6');
    expect(line).toContain('dangerLevel=2');
  });

  it('borne les scores 0–10', () => {
    expect(clampScore(15)).toBe(10);
    expect(clampScore(-1)).toBe(0);
  });
});
