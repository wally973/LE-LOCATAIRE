import {
  applyHead5ParoleSupplements,
  mentionsPrevenirVoisinDessus,
  supplementPrevenirVoisinDessus,
} from './head5-parole-supplement';
import { buildGrockHeadInputs } from '../../../head-input/head-input.pipeline';
import { socialHousingHeadEnrichmentPack } from '../../test-head-enrichment.pack';
import { buildInfiltrationPlafondMobileSignal } from '../../../fixtures/infiltration-plafond-mobile.fixture';

describe('head5-parole-supplement', () => {
  const headInputs = buildGrockHeadInputs(
    buildInfiltrationPlafondMobileSignal(),
    socialHousingHeadEnrichmentPack,
  );

  it('ajoute une proposition de prévenir le voisin du dessus si absente', () => {
    const out = supplementPrevenirVoisinDessus(
      'Nous transmettons le dossier au technicien.',
      true,
      'tenant',
    );
    expect(mentionsPrevenirVoisinDessus(out)).toBe(true);
    expect(out).toContain('prévenez votre voisin du dessus');
  });

  it('complète si seul le bailleur alerte le voisin', () => {
    const ack =
      'Nous allons alerter le voisin du logement au-dessus pour identifier l’origine.';
    const out = supplementPrevenirVoisinDessus(ack, true, 'tenant');
    expect(mentionsPrevenirVoisinDessus(out)).toBe(true);
    expect(out).toMatch(/prévenez votre voisin du dessus/i);
  });

  it('complète assurance/sécurité/photo si sinistre candidat et thèmes absents', () => {
    const out = applyHead5ParoleSupplements(
      'Nous transmettons au technicien bailleur pour diagnostic.',
      headInputs,
      'tenant',
      'sinistre',
    );
    expect(out).toMatch(/assurance|sinistre|5 jours/i);
    expect(out).toMatch(/sécur|humide|photo|preuve/i);
    expect(mentionsPrevenirVoisinDessus(out)).toBe(true);
  });

  it('n’applique pas hors surface locataire', () => {
    const ack = 'Brief technicien.';
    expect(supplementPrevenirVoisinDessus(ack, true, 'technician')).toBe(ack);
  });
});
