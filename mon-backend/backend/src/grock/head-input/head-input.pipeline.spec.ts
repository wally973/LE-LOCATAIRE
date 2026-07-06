import {
  buildEauElectriciteSignal,
  buildGenericTenantSignal,
} from '../fixtures/generic-tenant-signal.fixture';
import { emptyHeadEnrichmentPack } from '../domain/test-head-enrichment.pack';
import {
  buildGrockHeadInputs,
  serializeHeadInputsForJournal,
} from './head-input.pipeline';

describe('head-input.pipeline (noyau T1/T2)', () => {
  it('T2 produit dangerFlags sur eau + électricité (fixture générique)', () => {
    const inputs = buildGrockHeadInputs(buildEauElectriciteSignal(), emptyHeadEnrichmentPack);
    expect(inputs.head2.dangerFlags).toContain('eau_electricite_proximite');
    expect(inputs.head2.indicativeDangerLevel).toBeGreaterThanOrEqual(7);
  });

  it('assemble 5 blocs prompt — T1/T2 noyau + T3–T5 pack', () => {
    const inputs = buildGrockHeadInputs(buildGenericTenantSignal(), emptyHeadEnrichmentPack);
    expect(inputs.promptBlocks).toHaveLength(5);
    expect(inputs.promptBlocks[0]).toContain('Tête 1');
    expect(inputs.promptBlocks[1]).toContain('Tête 2');
    expect(inputs.promptBlocks[2]).toContain('pack neutre');
  });

  it('pack neutre — journal sans sinistre', () => {
    const inputs = buildGrockHeadInputs(buildGenericTenantSignal(), emptyHeadEnrichmentPack);
    const journal = serializeHeadInputsForJournal(inputs, emptyHeadEnrichmentPack);
    expect(journal.sinistre_probable).toBe(false);
    expect(journal.sinistre_candidat).toBe(false);
    expect(journal.infiltration_score).toBeNull();
  });
});
