import {
  applyClinicalLinkEffects,
  isTenantConfirmedClinicalLink,
  matchClinicalLinks,
  pickSavoirProbe,
  probeQuestionMatchesResolved,
} from './lia-savoir-clinical-links.loader';

describe('lia-savoir-clinical-links.loader', () => {
  const tvTitle = 'Pas de réception TV';
  const tvDescription = 'Depuis hier, la TV affiche aucun signal.';
  const escalierMessage =
    "mon voisin est absent, justement on a un souci d'éclairage dans l'escalier";

  it('matchClinicalLinks — sans escalier dans le message locataire → pas de lien confirmé', () => {
    const links = matchClinicalLinks({
      title: tvTitle,
      description: tvDescription,
      message: "bonjour j'ai plus de réception TV chez moi",
      housingKind: 'collective',
      activeFlows: ['signal'],
    });
    expect(links).toHaveLength(0);
  });

  it('matchClinicalLinks — TV + escalier en collectif (message locataire)', () => {
    const links = matchClinicalLinks({
      title: tvTitle,
      description: tvDescription,
      message: escalierMessage,
      housingKind: 'collective',
      activeFlows: ['signal'],
    });
    expect(links).toHaveLength(1);
    expect(isTenantConfirmedClinicalLink(links[0], escalierMessage)).toBe(true);
    expect(links[0].id).toBe('collectif_compteur_service_tv_eclairage');
    expect(links[0].tenantExplanation).toMatch(/compteur|amplificateur/i);
  });

  it('applyClinicalLinkEffects — clôture intake + étape service_meter_link', () => {
    const effects = applyClinicalLinkEffects({
      title: tvTitle,
      description: tvDescription,
      message: escalierMessage,
      housingKind: 'collective',
      activeFlows: ['signal'],
      resolvedSteps: ['savoir_collective'],
      hypotheses: [
        {
          id: 'chain_signal_amont',
          label: 'Amont',
          visualization: 'Amont signal',
          active: true,
          confidence: 0.5,
        },
        {
          id: 'chain_signal_local',
          label: 'Local',
          visualization: 'Poste local',
          active: true,
          confidence: 0.5,
        },
      ],
    });
    expect(effects.resolvedSteps).toContain('service_meter_link');
    expect(effects.intakeComplete).toBe(true);
    expect(
      effects.hypotheses.find((h) => h.id.includes('_local'))?.active,
    ).toBe(false);
  });

  it('pickSavoirProbe — voisins/communes en collectif avant sondage', () => {
    const probe = pickSavoirProbe({
      housingKind: 'collective',
      activeFlows: ['signal'],
      resolvedSteps: [],
      language: 'fr',
      title: 'Pas de réception TV',
      description: 'Depuis hier, la TV affiche aucun signal.',
    });
    expect(probe?.probe.id).toBe('collective_signal_neighbors_commons');
    expect(probe?.question).toMatch(/voisin|communes/i);
  });

  it('pickSavoirProbe — marche escalier collectif', () => {
    const probe = pickSavoirProbe({
      housingKind: 'collective',
      activeFlows: ['mécanique'],
      resolvedSteps: [],
      language: 'fr',
      title: 'Marche escalier abîmée',
      description: 'Dans la cage d escalier une marche est fissurée.',
    });
    expect(probe?.probe.id).toBe('collective_stair_step_safety');
    expect(probe?.question).toMatch(/marche|escalier|niveau/i);
  });

  it('pickSavoirProbe — boîte aux lettres', () => {
    const probe = pickSavoirProbe({
      housingKind: 'collective',
      activeFlows: ['mécanique'],
      resolvedSteps: [],
      language: 'fr',
      title: 'Boîte aux lettres bloquée',
      description: 'La clé tourne mal, je ne récupère plus le courrier.',
    });
    expect(probe?.probe.id).toBe('mailbox_lock_mechanism');
    expect(probe?.question).toMatch(/boîte|clé|couvercle/i);
  });

  it('probeQuestionMatchesResolved — évite répétition après savoir_collective', () => {
    const q =
      "Chez vos voisins ou sur les autres logements du bâtiment, la TV fonctionne-t-elle ? Et l'éclairage des parties communes s'allume-t-il ?";
    expect(probeQuestionMatchesResolved(q, ['savoir_collective'])).toBe(true);
    expect(probeQuestionMatchesResolved(q, [])).toBe(false);
  });
});
