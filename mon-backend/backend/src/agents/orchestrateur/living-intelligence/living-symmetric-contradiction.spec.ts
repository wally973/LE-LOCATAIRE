import { createLivingBuildingState } from './living-building-state.factory';
import { evaluateSymmetricContradiction } from './living-symmetric-contradiction';

describe('living-symmetric-contradiction', () => {
  it('interpelle si plombier proposé sur moisissure enveloppe', () => {
    const state = createLivingBuildingState({
      title: 'Moisissures',
      description: 'Taches au plafond après pluie',
      language: 'fr',
    });
    state.vision3d.mentalModels = ['Enveloppe'];
    state.vision3d.activeFlows = ['étanchéité'];

    const r = evaluateSymmetricContradiction(state, 'Envoyer un plombier pour les joints');
    expect(r.shouldChallenge).toBe(true);
    expect(r.politeChallengeFr).toMatch(/enveloppe/i);
  });

  it('pas de contradiction si proposition alignée', () => {
    const state = createLivingBuildingState({
      title: 'Carrelage',
      description: 'Carreaux soulévés chambre',
      language: 'fr',
    });
    const r = evaluateSymmetricContradiction(state, 'Solier pour reprendre le carrelage');
    expect(r.shouldChallenge).toBe(false);
  });
});
