import {
  GrockJournalRow,
  probeDegenerescence,
  probeFuite,
  probePreuveAvantConclusion,
  probeVarianceCadrage,
  runQualityProbes,
} from './grock-quality-probes';

function row(partial: Partial<GrockJournalRow>): GrockJournalRow {
  return {
    id: partial.id ?? `r-${Math.random().toString(36).slice(2, 8)}`,
    photoHash: partial.photoHash ?? null,
    title: partial.title ?? null,
    description: partial.description ?? null,
    tenantMessage: partial.tenantMessage ?? null,
    perception: partial.perception ?? null,
    state: partial.state ?? null,
    responsibility: partial.responsibility ?? null,
    acknowledgment: partial.acknowledgment ?? null,
    noteInterne: partial.noteInterne ?? null,
    model: partial.model ?? null,
    visionModel: partial.visionModel ?? null,
    createdAt: partial.createdAt ?? new Date(),
  };
}

describe('Sondes de qualité Grock (étage 2)', () => {
  it('variance_cadrage : même photo, responsabilités divergentes → candidat high', () => {
    const rows = [
      row({ id: 'a', photoHash: 'HASH1', state: 'bailleur_responsable' }),
      row({ id: 'b', photoHash: 'HASH1', state: 'locataire_responsable' }),
    ];
    const found = probeVarianceCadrage(rows);
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('high');
    expect(found[0].rowIds).toEqual(['a', 'b']);
  });

  it('variance_cadrage : même photo, même décision → aucun candidat', () => {
    const rows = [
      row({ photoHash: 'HASH2', state: 'bailleur_responsable' }),
      row({ photoHash: 'HASH2', state: 'READY_TICKET' }), // même classe BAILLEUR
    ];
    expect(probeVarianceCadrage(rows)).toHaveLength(0);
  });

  it('variance_cadrage : divergence mais aucune conclusion → ignoré', () => {
    const rows = [
      row({ photoHash: 'HASH3', state: 'NEED_PHOTO' }),
      row({ photoHash: 'HASH3', state: 'ASK_ONE_QUESTION' }),
    ];
    expect(probeVarianceCadrage(rows)).toHaveLength(0);
  });

  it('fuite : identifiant interne dans la parole visible → candidat high', () => {
    const rows = [
      row({ acknowledgment: 'Bonjour, votre terminal QV0373 est concerné.' }),
      row({ acknowledgment: 'Bonjour, pouvez-vous préciser le problème ?' }),
    ];
    const found = probeFuite(rows);
    expect(found).toHaveLength(1);
    expect(found[0].summary).toContain('QV0373');
  });

  it('degenerescence : mot nu → candidat', () => {
    const rows = [
      row({ acknowledgment: 'technicien', state: 'locataire_responsable' }),
      row({ acknowledgment: 'Pouvez-vous envoyer une photo de la zone ?' }),
    ];
    const found = probeDegenerescence(rows);
    expect(found).toHaveLength(1);
    expect(found[0].evidence[0]).toContain('technicien');
  });

  it('preuve_avant_conclusion : conclusion sans photo ni perception → candidat', () => {
    const rows = [
      row({ state: 'bailleur_responsable', photoHash: null, perception: null }),
      row({ state: 'bailleur_responsable', photoHash: 'HASH4' }), // a une preuve
      row({ state: 'sinistre', perception: 'mur fissuré' }), // a une perception
    ];
    const found = probePreuveAvantConclusion(rows);
    expect(found).toHaveLength(1);
    expect(found[0].summary).toContain('bailleur_responsable');
  });

  it('runQualityProbes : agrège et trie par sévérité (high avant warn)', () => {
    const rows = [
      row({ acknowledgment: 'technicien' }), // warn
      row({ acknowledgment: 'Référence SIDOM12 à traiter.' }), // high
    ];
    const found = runQualityProbes(rows);
    expect(found.length).toBeGreaterThanOrEqual(2);
    expect(found[0].severity).toBe('high');
  });
});
