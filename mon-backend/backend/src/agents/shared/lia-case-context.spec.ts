import { buildTenantCaseContext, splitPipelineFeedback } from './lia-case-context';

describe('lia-case-context', () => {
  it('isole le brief interne du contexte locataire', () => {
    const { tenantSupplement, internalBrief } = splitPipelineFeedback(
      'Interrupteur HS\n\n=== Recherche interne ===\n- siphon douche bailleur',
    );
    expect(tenantSupplement).toContain('Interrupteur');
    expect(internalBrief).toContain('Recherche interne');
    expect(
      buildTenantCaseContext({
        title: 'Électricité / éclairage',
        description: 'lumière ne marche plus',
        tenantSupplement,
      }),
    ).not.toContain('siphon douche');
  });
});
