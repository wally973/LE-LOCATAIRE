import { classifyTripleChargeFlux } from './lia-triple-flux-charge';

describe('lia-triple-flux-charge', () => {
  it('joint sous évier → LOCATIF (AFPOLS)', () => {
    const r = classifyTripleChargeFlux({
      title: 'Fuite',
      description: 'Fuite au joint du robinet sous l’évier cuisine',
    });
    expect(r.flux).toBe('LOCATIF');
    expect(r.legalBasis).toContain('87-712');
  });

  it('colonne refoulement → PATRIMOINE', () => {
    const r = classifyTripleChargeFlux({
      title: 'Eau sale',
      description: 'Refoulement colonne eaux usées au R+1',
    });
    expect(r.flux).toBe('PATRIMOINE');
    expect(r.legalBasis).toContain('1719');
  });

  it('moisissures mur salon → PATRIMOINE (enveloppe)', () => {
    const r = classifyTripleChargeFlux({
      title: 'Moisissures',
      description:
        'Le mur du salon adossé à la chambre a toujours de la moisissure malgré le nettoyage',
    });
    expect(r.flux).toBe('PATRIMOINE');
    expect(r.legalBasis).toContain('1719');
  });

  it('carrelage soulèvement chambre → PATRIMOINE', () => {
    const r = classifyTripleChargeFlux({
      title: 'Carrelage',
      description:
        'Les carreaux de la chambre de mon fils se sont levés d’un coup, un carreau est cassé',
    });
    expect(r.flux).toBe('PATRIMOINE');
    expect(r.legalBasis).toContain('1719');
  });

  it('VMC collective → RÉCUPÉRABLE avec explication charges', () => {
    const r = classifyTripleChargeFlux({
      title: 'VMC',
      description: 'La VMC collective ne tourne plus dans l’immeuble',
    });
    expect(r.flux).toBe('RECUPERABLE');
    expect(r.tenantExplanationFr).toMatch(/charges récupérables/i);
  });
});
