import { prepareTabulaRasaSavoir } from './living-tabula-savoir';
import { extractThreeSentences } from './living-tabula-rasa';

describe('living-tabula-savoir', () => {
  it('bibliothèque brute sans perceptionBrief', () => {
    const { bibliothequeSavoir, savoirConsulted } = prepareTabulaRasaSavoir();
    expect(bibliothequeSavoir.pathologies.length).toBeGreaterThan(0);
    expect(bibliothequeSavoir.loisEtDecrets.length).toBeGreaterThan(0);
    expect(savoirConsulted.length).toBeGreaterThan(0);
    expect(JSON.stringify(bibliothequeSavoir)).not.toMatch(/PERCEPTION MÉTIER/i);
    expect(JSON.stringify(bibliothequeSavoir)).not.toMatch(/TRIPLE FLUX/i);
  });

  it('extractThreeSentences — trois dernières phrases', () => {
    const phrases = extractThreeSentences(
      'Première phrase. Deuxième phrase. Troisième phrase. Quatrième phrase.',
    );
    expect(phrases).toEqual(['Deuxième phrase.', 'Troisième phrase.', 'Quatrième phrase.']);
  });
});
