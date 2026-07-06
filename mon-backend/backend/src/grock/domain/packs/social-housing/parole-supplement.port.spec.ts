import { buildInfiltrationPlafondMobileSignal } from '../../../fixtures/infiltration-plafond-mobile.fixture';
import { buildGenericTenantSignal } from '../../../fixtures/generic-tenant-signal.fixture';
import {
  emptyHeadEnrichmentPack,
  socialHousingHeadEnrichmentPack,
} from '../../test-head-enrichment.pack';
import { buildGrockHeadInputs } from '../../../head-input/head-input.pipeline';
import { mentionsPrevenirVoisinDessus } from './head5-parole-supplement';
import { applySocialHousingParoleSupplements } from './apply-parole-supplements';

describe('ParoleSupplementPort — pack logement social (phase 5)', () => {
  it('applySocialHousingParoleSupplements complète voisin + assurance si sinistre', () => {
    const headInputs = buildGrockHeadInputs(
      buildInfiltrationPlafondMobileSignal(),
      socialHousingHeadEnrichmentPack,
    );
    const out = applySocialHousingParoleSupplements({
      acknowledgment: 'Nous transmettons au technicien bailleur pour diagnostic.',
      headInputs,
      interlocutor: 'tenant',
      state: 'sinistre',
    });
    expect(mentionsPrevenirVoisinDessus(out)).toBe(true);
    expect(out).toMatch(/assurance|sinistre|5 jours/i);
  });

  it('via test pack bridge — même comportement', () => {
    const headInputs = buildGrockHeadInputs(
      buildInfiltrationPlafondMobileSignal(),
      socialHousingHeadEnrichmentPack,
    );
    const out = socialHousingHeadEnrichmentPack.applyParoleSupplements({
      acknowledgment: 'Transmission au technicien.',
      headInputs,
      interlocutor: 'tenant',
      state: 'sinistre',
    });
    expect(mentionsPrevenirVoisinDessus(out)).toBe(true);
  });

  it('n’altère pas hors surface locataire', () => {
    const headInputs = buildGrockHeadInputs(
      buildGenericTenantSignal(),
      socialHousingHeadEnrichmentPack,
    );
    const ack = 'Brief technicien.';
    expect(
      applySocialHousingParoleSupplements({
        acknowledgment: ack,
        headInputs,
        interlocutor: 'technician',
        state: 'READY_TICKET',
      }),
    ).toBe(ack);
  });

  it('respecte les tours précoces ASK_ONE_QUESTION', () => {
    const headInputs = buildGrockHeadInputs(
      buildInfiltrationPlafondMobileSignal(),
      socialHousingHeadEnrichmentPack,
    );
    const ack = 'Quelle pièce est touchée ?';
    expect(
      applySocialHousingParoleSupplements({
        acknowledgment: ack,
        headInputs,
        interlocutor: 'tenant',
        state: 'ASK_ONE_QUESTION',
      }),
    ).toBe(ack);
  });
});

describe('ParoleSupplementPort — pack neutre', () => {
  it('emptyHeadEnrichmentPack ne modifie pas la parole', () => {
    const headInputs = buildGrockHeadInputs(
      buildInfiltrationPlafondMobileSignal(),
      emptyHeadEnrichmentPack,
    );
    const ack = 'Message inchangé.';
    expect(
      emptyHeadEnrichmentPack.applyParoleSupplements({
        acknowledgment: ack,
        headInputs,
        interlocutor: 'tenant',
        state: 'sinistre',
      }),
    ).toBe(ack);
  });
});
