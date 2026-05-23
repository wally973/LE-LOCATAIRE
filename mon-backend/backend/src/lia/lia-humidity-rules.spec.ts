import {
  parseHumidityChargeSignals,
  resolveHumidityCharge,
} from './lia-humidity-rules';
import type { PathologistResult } from '../ai-routing/agents/pathologist.types';

function patho(partial: Partial<PathologistResult>): PathologistResult {
  return {
    category: 'HUMIDITY',
    severity: 'MEDIUM',
    confidence: 0.8,
    needsMorePhoto: false,
    observation: partial.observation ?? '',
    fromLlm: false,
    ...partial,
  };
}

describe('resolveHumidityCharge', () => {
  it('bailleur si infiltration / structure sur photo', () => {
    const text =
      'moisissure plafond infiltration quand il pleut j ai deja peint';
    const signals = parseHumidityChargeSignals(
      text,
      patho({
        humidityPhoto: {
          structuralDegradationVisible: true,
          tenantSurfaceNeglectOnly: false,
          indicators: ['infiltration'],
        },
      }),
      true,
    );
    expect(resolveHumidityCharge(signals)).toBe('BAILLEUR');
  });

  it('locataire bricoleur + photo sans dégradation structurelle', () => {
    const text =
      'moisissure coin chambre j ai deja traite avec produit et aere';
    const signals = parseHumidityChargeSignals(
      text,
      patho({
        humidityPhoto: {
          structuralDegradationVisible: false,
          tenantSurfaceNeglectOnly: true,
          indicators: [],
        },
      }),
      true,
    );
    expect(resolveHumidityCharge(signals)).toBe('LOCATAIRE');
  });

  it('locataire bricoleur sans photo', () => {
    const text = 'humidite salle de bain j ai essaye de nettoyer';
    const signals = parseHumidityChargeSignals(text, patho({}), false);
    expect(resolveHumidityCharge(signals)).toBe('LOCATAIRE');
  });
});
