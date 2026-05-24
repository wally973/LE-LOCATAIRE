import { loadMasterDiagnosticRules } from './master-diagnostic-rules.loader';

describe('master-diagnostic-rules.json', () => {
  it('charge les 5 domaines Savoir-Voir', () => {
    const catalog = loadMasterDiagnosticRules();
    const ids = catalog.domains.map((d) => d.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'ELECTRICITY',
        'CARPENTRY',
        'VMC',
        'TERMITES',
        'COMMON_AREAS',
      ]),
    );
    expect(catalog.domains).toHaveLength(5);
  });
});
