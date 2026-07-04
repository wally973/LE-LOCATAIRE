import { loadGrockDeductionDoctrine } from './grock-deduction-ledger';

describe('loadGrockDeductionDoctrine', () => {
  it('charge les principes validés du registre, sans aucune règle Arbor injectée', () => {
    const block = loadGrockDeductionDoctrine('PLUMBING_WATER');

    // Les leçons transférables (Stylo) restent la seule doctrine injectée.
    expect(block).toContain('leçons transférables validées');
    expect(block).toContain('SINISTRE_ASSURANCE_NOT_FINAL_CHARGE');

    // Le faux Arbor (arbre de décision / patterns) a disparu du prompt.
    expect(block).not.toContain('Règles ARBOR');
    expect(block).not.toContain('Override state');
    expect(block).not.toMatch(/ARBOR_/);
  });
});
