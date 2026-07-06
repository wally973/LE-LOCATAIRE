import type { PreprocessedSignal } from '../../../preprocessor/preprocessor.types';
import { buildInfiltrationPlafondMobileSignal } from '../../../fixtures/infiltration-plafond-mobile.fixture';
import { socialHousingHeadEnrichmentPack } from '../../test-head-enrichment.pack';
import { buildGrockHeadInputs } from '../../../head-input/head-input.pipeline';

function gouttesPlafondSignal(overrides: Partial<PreprocessedSignal> = {}): PreprocessedSignal {
  return buildInfiltrationPlafondMobileSignal({
    title: "j'ai des gouttes d'eau qui coule du plafond",
    description: "j'ai des gouttes d'eau qui coule du plafond",
    tenantMessage: "j'ai des gouttes d'eau qui coule du plafond",
    visualPerceptionRaw: 'plafond du WC taché, auréoles brunes, gouttes, humidité au plafond',
    ...overrides,
  });
}

describe('pack social-housing — pipeline T3→T5', () => {
  it('cas gouttes d’eau au plafond — scores T3 ~9 et sinistre candidat', () => {
    const inputs = buildGrockHeadInputs(gouttesPlafondSignal(), socialHousingHeadEnrichmentPack);

    expect(inputs.head1.waterSignal).toBe(true);
    expect(inputs.head1.activeWater).toBe(true);
    expect(inputs.head1.ceilingSignal).toBe(true);
    expect(inputs.head3.infiltration_score).toBeGreaterThanOrEqual(8);
    expect(inputs.head3.degat_des_eaux_score).toBeGreaterThanOrEqual(8);
    expect(inputs.head3.sinistre_probable).toBe(true);
    expect(inputs.head4.sinistre_candidat).toBe(true);
    expect(inputs.head4.candidateStates).toContain('sinistre_candidat');
    expect(inputs.head4.candidateStates).toContain('ASK_ONE_QUESTION');
    expect(inputs.head5.speechThemes).toContain('securite');
    expect(inputs.head5.speechThemes).toContain('photo');
    expect(inputs.head5.speechThemes).toContain('assurance_sinistre');
    expect(inputs.head5.speechThemes).toContain('delai_5j');
    expect(inputs.head5.speechThemes).toContain('prevenir_voisin_dessus');
    expect(inputs.head4.irsiRecours).not.toBeNull();
  });

  it('couvre le libellé mobile REF (eau qui coule du plafond salle de bain)', () => {
    const inputs = buildGrockHeadInputs(buildInfiltrationPlafondMobileSignal(), socialHousingHeadEnrichmentPack);
    expect(inputs.head3.originFromAbove).toBe(true);
    expect(inputs.head3.sinistre_probable).toBe(true);
    expect(inputs.head5.speechThemes).toContain('prevenir_voisin_dessus');
    expect(inputs.head1.roomKnown).toBe(true);
  });

  it('mentionne constat amiable si voisin impliqué', () => {
    const inputs = buildGrockHeadInputs(
      gouttesPlafondSignal({
        description: "De l'eau tombe du plafond, le voisin du dessus a une fuite",
        tenantMessage: 'Le voisin du dessus dit que sa douche fuit',
        visualPerceptionRaw: null,
        meta: { role: 'tenant', textFieldsNormalized: 0, imageProcessed: false },
      }),
      socialHousingHeadEnrichmentPack,
    );
    expect(inputs.head3.neighborInvolved).toBe(true);
    expect(inputs.head3.origine_voisin_score).toBeGreaterThanOrEqual(5);
    expect(inputs.head4.irsiRecours?.originKind).toBe('voisin');
  });

  it('n’active pas sinistre pour fuite siphon sans plafond', () => {
    const inputs = buildGrockHeadInputs(
      gouttesPlafondSignal({
        title: 'Fuite sous évier',
        description: 'Le siphon fuit sous l’évier de la cuisine',
        tenantMessage: 'fuite au siphon',
        visualPerceptionRaw: 'siphon plastique qui fuit au raccord',
      }),
      socialHousingHeadEnrichmentPack,
    );
    expect(inputs.head3.sinistre_probable).toBe(false);
    expect(inputs.head4.sinistre_candidat).toBe(false);
    expect(inputs.head5.speechThemes).not.toContain('assurance_sinistre');
  });
});
