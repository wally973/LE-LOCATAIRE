import { analyzeCapteurParoleAlignment } from './learning/grock-capteur-parole-probe';
import {
  assertInfiltrationPlafondMobileParole,
  buildInfiltrationPlafondMobileSignal,
  INFILTRATION_PLAFOND_MOBILE_REF,
  isInfiltrationPlafondMobileSignalement,
} from './fixtures/infiltration-plafond-mobile.fixture';
import { buildGrockHeadInputs } from './head-input/head-input.pipeline';
import { socialHousingHeadEnrichmentPack } from './domain/test-head-enrichment.pack';

describe('REF_INFILTRATION_PLAFOND_MOBILE (régression mobile)', () => {
  const signal = buildInfiltrationPlafondMobileSignal();
  const headInputs = buildGrockHeadInputs(signal, socialHousingHeadEnrichmentPack);

  it('reconnaît le signalement du cas de référence', () => {
    const ref = INFILTRATION_PLAFOND_MOBILE_REF;
    expect(isInfiltrationPlafondMobileSignalement(ref.title, ref.description)).toBe(true);
  });

  it('T3 infiltration_score ~9 et sinistre_probable', () => {
    expect(headInputs.head3.infiltration_score).toBeGreaterThanOrEqual(8);
    expect(headInputs.head3.sinistre_probable).toBe(true);
  });

  it('T4 sinistre_candidat + ASK_ONE_QUESTION si origine mixte', () => {
    expect(headInputs.head4.sinistre_candidat).toBe(true);
    expect(headInputs.head4.candidateStates).toContain('sinistre_candidat');
    expect(headInputs.head4.irsiRecours).not.toBeNull();
  });

  it('T5 thèmes sécurité + photos + assurance 5 jours + prévenir voisin', () => {
    expect(headInputs.head5.speechThemes).toEqual(
      expect.arrayContaining(['securite', 'photo', 'assurance_sinistre', 'delai_5j', 'prevenir_voisin_dessus']),
    );
  });

  it('valide une bulle type essai mobile #121', () => {
    const ack =
      'Merci pour la photo, Marie. Cela confirme une infiltration active au plafond. ' +
      'Nous transmettons immédiatement votre signalement à notre technicien pour un diagnostic sous 48h. ' +
      'En attendant, restez à distance de la zone humide et ne touchez pas aux prises ou luminaires proches. ' +
      'Pensez à prévenir le voisin du logement au-dessus pour l’alerter de la fuite. ' +
      'Nous vous rappelons de déclarer le sinistre à votre assurance dans les 5 jours ouvrés.';

    expect(assertInfiltrationPlafondMobileParole(ack)).toEqual([]);

    const report = analyzeCapteurParoleAlignment({
      state: 'sinistre',
      tenantMessage: INFILTRATION_PLAFOND_MOBILE_REF.description,
      noteInterne:
        'Infiltration plafond = origine au-dessus (voisin ou toiture bailleur). Déclaration assurance 5 jours.',
      acknowledgment: ack,
    });
    expect(report.missingInSpeech).not.toContain('prevenir_voisin_dessus');
    expect(report.missingInSpeech).not.toContain('assurance_sinistre');
  });

  it('garde-fou complète parole sinistre incomplète', () => {
    const out = socialHousingHeadEnrichmentPack.applyParoleSupplements({
      acknowledgment: 'Nous transmettons au technicien.',
      headInputs,
      interlocutor: 'tenant',
      state: 'sinistre',
    });
    expect(assertInfiltrationPlafondMobileParole(out)).toEqual([]);
  });
});
