import { createLivingBuildingState } from './living-building-state.factory';
import {
  buildNewDossierRequestMessage,
  detectDossierTopicBreach,
  sealDossierIntegrity,
} from './living-dossier-integrity';

describe('living-dossier-integrity — un ticket = un métier', () => {
  it('scelle le dossier quand READY_FOR_TECHNICIAN', () => {
    let state = createLivingBuildingState({
      title: 'Moisissures',
      description: 'taches noires plafond chambre',
      language: 'fr',
    });
    state = {
      ...state,
      readiness: 'READY_FOR_TECHNICIAN',
      intervention: {
        ...state.intervention,
        tradeNeeded: 'Maçon',
        readyForDispatch: true,
      },
    };
    const sealed = sealDossierIntegrity(state);
    expect(sealed.dossierIntegrity.sealed).toBe(true);
    expect(sealed.dossierIntegrity.primaryTrade).toBe('Maçon');
    expect(sealed.dossierIntegrity.oneTicketOneTrade).toBe(true);
  });

  it('détecte un nouveau sujet après scellement', () => {
    let state = createLivingBuildingState({
      title: 'Moisissures',
      description: 'taches noires plafond chambre',
      language: 'fr',
    });
    state = sealDossierIntegrity({
      ...state,
      readiness: 'READY_FOR_TECHNICIAN',
      intervention: { ...state.intervention, tradeNeeded: 'Maçon', readyForDispatch: true },
    });
    const breach = detectDossierTopicBreach({
      state,
      message: 'Sinon ma porte d’entrée ne ferme plus du tout',
    });
    expect(breach.isNewSubject).toBe(true);
    expect(breach.detectedLabel).toBeTruthy();
  });

  it('laisse passer un message lié au même dossier', () => {
    let state = createLivingBuildingState({
      title: 'Moisissures',
      description: 'taches noires plafond chambre',
      language: 'fr',
    });
    state = sealDossierIntegrity({
      ...state,
      readiness: 'READY_FOR_TECHNICIAN',
      intervention: { ...state.intervention, tradeNeeded: 'Maçon', readyForDispatch: true },
    });
    const breach = detectDossierTopicBreach({
      state,
      message: 'Les taches au plafond grossissent encore',
    });
    expect(breach.isNewSubject).toBe(false);
  });

  it('buildNewDossierRequestMessage — invite nouvelle demande', () => {
    const msg = buildNewDossierRequestMessage('Marie', 'Porte', 'fr');
    expect(msg).toMatch(/nouvelle demande/i);
    expect(msg).toMatch(/un ticket, un métier/i);
  });
});
