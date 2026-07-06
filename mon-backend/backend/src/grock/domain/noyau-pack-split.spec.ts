import {
  buildEauElectriciteSignal,
  buildGenericTenantSignal,
} from '../fixtures/generic-tenant-signal.fixture';
import {
  emptyHeadEnrichmentPack,
  socialHousingHeadEnrichmentPack,
} from './test-head-enrichment.pack';
import { buildGrockHeadInputs } from '../head-input/head-input.pipeline';
import { buildHead1AnalysisInput } from '../head-input/head1-analysis.input';
import { buildHead2VerificationInput } from '../head-input/head2-verification.input';

describe('isolation noyau ↔ pack (phase 4)', () => {
  const genericSignal = buildGenericTenantSignal();

  it('T1/T2 identiques quel que soit le pack branché', () => {
    const withEmpty = buildGrockHeadInputs(genericSignal, emptyHeadEnrichmentPack);
    const withSocial = buildGrockHeadInputs(genericSignal, socialHousingHeadEnrichmentPack);
    expect(withEmpty.head1).toEqual(withSocial.head1);
    expect(withEmpty.head2).toEqual(withSocial.head2);
  });

  it('signal générique + pack neutre — pas de sinistre ni scores métier', () => {
    const inputs = buildGrockHeadInputs(genericSignal, emptyHeadEnrichmentPack);
    expect(inputs.head3.sinistre_probable).toBe(false);
    expect(inputs.head3.infiltration_score).toBe(0);
    expect(inputs.head4.sinistre_candidat).toBe(false);
    expect(inputs.promptBlocks.slice(2).join('\n')).toContain('pack neutre');
    expect(inputs.promptBlocks.slice(2).join('\n')).not.toContain('infiltration_score');
  });

  it('signal générique + pack logement — pas de sinistre sans eau/plafond', () => {
    const inputs = buildGrockHeadInputs(genericSignal, socialHousingHeadEnrichmentPack);
    expect(inputs.head1.waterSignal).toBe(false);
    expect(inputs.head1.ceilingSignal).toBe(false);
    expect(inputs.head3.sinistre_probable).toBe(false);
    expect(inputs.head4.sinistre_candidat).toBe(false);
    expect(inputs.head5.speechThemes).not.toContain('assurance_sinistre');
  });

  it('pack neutre — supplements parole transparents', () => {
    const inputs = buildGrockHeadInputs(genericSignal, emptyHeadEnrichmentPack);
    const ack = 'Nous transmettons au technicien.';
    const out = emptyHeadEnrichmentPack.applyParoleSupplements({
      acknowledgment: ack,
      headInputs: inputs,
      interlocutor: 'tenant',
      state: 'READY_TICKET',
    });
    expect(out).toBe(ack);
  });

  it('T1 porte — aucun signal eau/plafond (noyau seul)', () => {
    const head1 = buildHead1AnalysisInput(genericSignal);
    const head2 = buildHead2VerificationInput(genericSignal, head1);
    expect(head1.waterSignal).toBe(false);
    expect(head1.ceilingSignal).toBe(false);
    expect(head2.dangerFlags).not.toContain('eau_electricite_proximite');
  });
});

describe('isolation noyau ↔ pack — danger T2 (fixture générique)', () => {
  it('eau + électricité détectés par T2 sans pack métier sinistre', () => {
    const signal = buildEauElectriciteSignal();
    const inputs = buildGrockHeadInputs(signal, emptyHeadEnrichmentPack);
    expect(inputs.head2.dangerFlags).toContain('eau_electricite_proximite');
    expect(inputs.head4.sinistre_candidat).toBe(false);
  });
});
