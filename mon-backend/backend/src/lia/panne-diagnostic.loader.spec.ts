import {
  detectPanneFromText,
  loadPanneDiagnosticCatalog,
  nextOrganizerCause,
  answerEliminatesCause,
} from './panne-diagnostic.loader';

describe('panne-diagnostic.loader', () => {
  it('charge le catalogue', () => {
    const cat = loadPanneDiagnosticCatalog();
    expect(cat.panes.length).toBeGreaterThanOrEqual(10);
    expect(cat.region).toBe('GUYANE');
  });

  it('détecte éclairage localisé', () => {
    const tree = detectPanneFromText(
      'La lumière de la salle de bain ne marche plus',
    );
    expect(tree?.id).toBe('PANNE_ECLAIRAGE_LOCALISE');
  });

  it('priorise danger HIGH avant ampoule (règle organisateur)', () => {
    const tree = detectPanneFromText(
      'La lumière de la salle de bain ne marche plus, ampoule changée',
    )!;
    expect(tree).toBeDefined();
    const ctx =
      'La lumière de la salle de bain ne marche plus, ampoule changée';
    const first = nextOrganizerCause(tree!, [], ctx);
    expect(first?.id).toBe('cause_disjoncteur_circuit_declenche');
    const ampoule = tree!.causes.find((c) => c.id === 'cause_ampoule_usee')!;
    expect(answerEliminatesCause('Oui ampoule neuve posée', ampoule)).toBe(true);
  });
});
