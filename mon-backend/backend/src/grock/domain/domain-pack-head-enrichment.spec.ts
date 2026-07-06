import { buildInfiltrationPlafondMobileSignal } from '../fixtures/infiltration-plafond-mobile.fixture';
import { buildGrockHeadInputs } from '../head-input/head-input.pipeline';
import { buildHead1AnalysisInput } from '../head-input/head1-analysis.input';
import { buildHead2VerificationInput } from '../head-input/head2-verification.input';
import { buildSignalCorpus } from '../head-input/corpus.util';
import {
  emptyHeadEnrichmentPack,
  socialHousingHeadEnrichmentPack,
} from './test-head-enrichment.pack';
import { enrichHead3Empty } from './empty-head-enrichment';

describe('DOMAIN_PACK — enrichissement T3–T5 (phase 1)', () => {
  const signal = buildInfiltrationPlafondMobileSignal();

  it('pack logement social — infiltration plafond actif', () => {
    const inputs = buildGrockHeadInputs(signal, socialHousingHeadEnrichmentPack);
    expect(inputs.head3.infiltration_score).toBeGreaterThanOrEqual(8);
    expect(inputs.head3.sinistre_probable).toBe(true);
    expect(inputs.head4.sinistre_candidat).toBe(true);
    expect(inputs.head5.speechThemes).toContain('prevenir_voisin_dessus');
    expect(inputs.promptBlocks.join('\n')).toContain('infiltration_score');
  });

  it('pack neutre — pas de sinistre ni scores métier', () => {
    const inputs = buildGrockHeadInputs(signal, emptyHeadEnrichmentPack);
    expect(inputs.head3.sinistre_probable).toBe(false);
    expect(inputs.head3.infiltration_score).toBe(0);
    expect(inputs.head4.sinistre_candidat).toBe(false);
    expect(inputs.promptBlocks.join('\n')).toContain('pack neutre');
  });

  it('enrichHead3Empty est stable', () => {
    const empty = enrichHead3Empty();
    expect(empty.degat_des_eaux_score).toBe(0);
    expect(empty.promptBlock).toContain('pack neutre');
  });

  it('le pack consomme T1/T2 sans les recalculer', () => {
    const head1 = buildHead1AnalysisInput(signal);
    const head2 = buildHead2VerificationInput(signal, head1);
    const ctx = {
      signal,
      head1,
      head2,
      corpus: buildSignalCorpus(signal),
    };
    const h3 = socialHousingHeadEnrichmentPack.enrichHead3(ctx);
    expect(h3.infiltration_score).toBeGreaterThanOrEqual(8);
    expect(head1.ceilingSignal).toBe(true);
  });
});
