import {
  inferHvacPhotoCuesFromText,
  runHvacDifferential,
} from './lia-hvac-pathology';

describe('lia-hvac-pathology — clim qui fuit (Guyane)', () => {
  const drySeason = { weather_context: 'Saison sèche' };

  it('bac à condensats bouché : eau sous split, pas de fuite frigo', () => {
    const diff = runHvacDifferential({
      contextText:
        'la climatisation fuit eau sous le split bac a condensat bouche gouttelettes',
      sensors: drySeason,
      photo: {
        condensateOverflowVisible: true,
        stainUnderIndoorUnit: true,
        darkHaloVisible: false,
      },
    });

    expect(diff.leadingHypothesisId).toBe('hyp_hvac_condensate_blocked');
    expect(diff.responsibilityHint).toBe('LOCATAIRE');
  });

  it('fuite frigorifique : traces huile, ne refroidit plus', () => {
    const diff = runHvacDifferential({
      contextText:
        'climatiseur ne refroidit plus fuite avec trace huile sur liaison frigorifique',
      sensors: drySeason,
      photo: inferHvacPhotoCuesFromText(
        'trace huile fuite frigorifique ne refroidit plus',
      ),
    });

    expect(diff.leadingHypothesisId).toBe('hyp_hvac_refrigerant_leak');
    expect(diff.responsibilityHint).toBe('BAILLEUR');
  });

  it('auréole sombre + saison sèche → écarte toiture, oriente fuite interne', () => {
    const diff = runHvacDifferential({
      contextText: 'auréole sombre au plafond sous la clim',
      sensors: drySeason,
      photo: { darkHaloVisible: true },
    });

    expect(diff.roofInfiltrationExcluded).toBe(true);
    const roof = diff.hypotheses.find((h) => h.id === 'hyp_hvac_roof_infiltration');
    expect(roof?.eliminated).toBe(true);
    expect(diff.observation).toMatch(/pas une infiltration de toiture|fuite interne/i);
    expect(diff.leadingHypothesisId).not.toBe('hyp_hvac_roof_infiltration');
  });
});
