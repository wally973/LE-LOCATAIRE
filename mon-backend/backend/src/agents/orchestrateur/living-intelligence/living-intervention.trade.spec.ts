import {
  deriveSovereignTradeFromVision,
  isPlumberMismatchForEnvelope,
  reconcileEnqueteurTrade,
  sanitizePartsToBring,
} from './living-intervention.trade';
import type { LivingVision3D } from './living-building-state.types';

function vision(partial: Partial<LivingVision3D>): LivingVision3D {
  return {
    floorLevel: null,
    rooms: [],
    element: null,
    symptomAnchor: null,
    above: null,
    below: null,
    climate: 'tropical_humid',
    activeFlows: [],
    mentalModels: [],
    hypotheses: [],
    ...partial,
  };
}

describe('living-intervention.trade — souveraineté Enquêteur', () => {
  it('carrelage qui se soulève → Solier', () => {
    const v = vision({ symptomAnchor: 'carreaux levés chambre' });
    expect(
      deriveSovereignTradeFromVision(
        v,
        'Carrelage chambre fils soulèvement carreau cassé',
      ),
    ).toBe('Solier');
  });

  it('étanchéité + Enveloppe → Maçon ou Étanchéiste, jamais Plombier', () => {
    const v = vision({
      activeFlows: ['étanchéité'],
      mentalModels: ['Enveloppe'],
      symptomAnchor: 'moisissures au plafond',
    });
    expect(deriveSovereignTradeFromVision(v, 'Moisissures salon')).toMatch(/Maçon|Étanchéiste/);
    expect(
      isPlumberMismatchForEnvelope('Plombier', v, 'Moisissures au plafond'),
    ).toBe(true);
    expect(
      reconcileEnqueteurTrade('Plombier', v, 'Moisissures au plafond'),
    ).toMatch(/Maçon|Étanchéiste/);
  });

  it('fuite sous évier → Plombier conservé', () => {
    const v = vision({
      activeFlows: ['pression amont', 'exutoire'],
      symptomAnchor: 'fuite sous évier',
    });
    expect(reconcileEnqueteurTrade('Plombier', v, 'Fuite évier cuisine')).toBe('Plombier');
  });

  it('supprime pièces génériques joints/bouches sur flux enveloppe', () => {
    const v = vision({
      activeFlows: ['étanchéité'],
      mentalModels: ['Enveloppe'],
    });
    const cleaned = sanitizePartsToBring(
      ['Joints silicone', 'Bouches VMC', 'Membrane étanchéité'],
      v,
    );
    expect(cleaned).toEqual(['Membrane étanchéité']);
  });
});
