import {
  buildDiagnosticState,
  extractClinicalSignsFromText,
  normalizeClinicalText,
} from './lia-diagnostic-state';
import { loadPathologyIndex } from './knowledge-index.loader';

describe('lia-diagnostic-state', () => {
  beforeAll(() => {
    loadPathologyIndex();
  });

  it('extrait salpêtre et motif pluie', () => {
    const text =
      'taches au plafond quand il pleut odeur de moisi salpetre sur le mur';
    const signs = extractClinicalSignsFromText(text);
    expect(signs.some((s) => s.channel === 'odor')).toBe(true);
    expect(signs.some((s) => s.channel === 'color')).toBe(true);
    expect(signs.some((s) => s.channel === 'pattern')).toBe(true);
  });

  it('score remontée capillaire vs condensation', () => {
    const text =
      'salpetre en bas du mur franges depuis les plinthes pas seulement apres la douche';
    const state = buildDiagnosticState({
      category: 'HUMIDITY',
      contextText: text,
    });
    expect(state.leadingHypothesisId).toBe('hyp_remontee_capillaire');
    expect(state.researchRefs.some((r) => r.ref === 'B.01')).toBe(true);
  });

  it('condensation si coin sdb sans salpêtre', () => {
    const text =
      'moisissure noire coin fenetre salle de bain ventilation linges seches';
    const state = buildDiagnosticState({
      category: 'HUMIDITY',
      contextText: text,
    });
    expect(
      state.hypotheses.some((h) => h.id === 'hyp_condensation_usage'),
    ).toBe(true);
  });

  it('normalizeClinicalText retire accents', () => {
    expect(normalizeClinicalText('Salpêtre')).toBe('salpetre');
  });
});
