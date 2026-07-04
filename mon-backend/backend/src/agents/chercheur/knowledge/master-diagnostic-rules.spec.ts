import { loadMasterDiagnosticRules } from './master-diagnostic-rules.loader';

describe('master-diagnostic-rules.json', () => {
  it('charge les 5 fiches passives Savoir-Voir', () => {
    const catalog = loadMasterDiagnosticRules();
    const ids = catalog.fiches.map((d) => d.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'ELECTRICITY',
        'CARPENTRY',
        'VMC',
        'TERMITES',
        'COMMON_AREAS',
      ]),
    );
    expect(catalog.fiches).toHaveLength(5);
    expect(catalog.schema).toBe('PASSIVE_KNOWLEDGE_SHEET');
  });
});
