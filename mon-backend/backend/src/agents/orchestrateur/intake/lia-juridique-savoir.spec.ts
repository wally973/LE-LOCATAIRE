import {
  matchLegalThemes,
  pickLegalClarificationProbe,
} from './lia-juridique-savoir.loader';

describe('lia-juridique-savoir.loader', () => {
  it('matchLegalThemes — boîte rouillée charge locataire', () => {
    const themes = matchLegalThemes({
      title: 'Boîte aux lettres rouillée',
      description:
        'Ma boîte est rouillée, le bailleur dit que c est une réparation locative à ma charge.',
      message: '',
    });
    expect(themes.some((t) => t.id === 'reparation_boite_lettres_nuance')).toBe(true);
  });

  it('matchLegalThemes — retenue de loyer', () => {
    const themes = matchLegalThemes({
      title: 'Loyer',
      description: 'Je veux retenir mon loyer car le chauffage ne marche plus.',
      message: '',
    });
    expect(themes.some((t) => t.id === 'retenue_loyer_risque')).toBe(true);
  });

  it('pickLegalClarificationProbe — silence bailleur', () => {
    const probe = pickLegalClarificationProbe({
      title: 'Fuite',
      description: 'Signalement il y a six semaines par mail, le bailleur ne répond plus.',
      message: '',
      language: 'fr',
    });
    expect(probe?.probe.id).toBe('legal_clarify_silence_bailleur');
    expect(probe?.question).toMatch(/quand|mail|alerté/i);
  });

  it('pickLegalClarificationProbe — pas de loi dans la question locataire', () => {
    const probe = pickLegalClarificationProbe({
      title: 'Hall insalubre',
      description: 'Le hall est sale, odeur de poubelles, insalubre.',
      message: '',
      language: 'fr',
    });
    // Lieu déjà clair (hall + insalubrité) — pas de re-sonde logement vs communs.
    expect(probe).toBeNull();
  });

  it('pickLegalClarificationProbe — hall insalubre ambigu garde une sonde', () => {
    const probe = pickLegalClarificationProbe({
      title: 'Insalubrité',
      description: 'Ça sent mauvais dans l immeuble depuis des semaines.',
      message: '',
      language: 'fr',
    });
    expect(probe?.question).toBeDefined();
    expect(probe!.question).not.toMatch(/87-712|1719|décret|code civil/i);
  });

  it('matchLegalThemes — ascenseur en panne', () => {
    const themes = matchLegalThemes({
      title: 'Ascenseur bloqué',
      description: "L'ascenseur est en panne depuis trois jours, je suis au 4e sans pouvoir descendre.",
      message: '',
    });
    expect(themes.some((t) => t.id === 'ascenseur_partie_commune')).toBe(true);
  });

  it('matchLegalThemes — nuisibles et décence', () => {
    const themes = matchLegalThemes({
      title: 'Cafards',
      description: 'Des cafards dans la cuisine depuis deux semaines, ça empire.',
      message: '',
    });
    expect(themes.some((t) => t.id === 'nuisibles_decence_logement')).toBe(true);
  });

  it('pickLegalClarificationProbe — ascenseur sans litige de charge', () => {
    const probe = pickLegalClarificationProbe({
      title: 'Ascenseur en panne',
      description: "L'ascenseur ne remonte plus depuis lundi au 5e étage.",
      message: '',
      language: 'fr',
    });
    expect(probe?.probe.id).toBe('legal_clarify_ascenseur');
    expect(probe?.question).toMatch(/depuis|palier|bloqu/i);
    expect(probe!.question).not.toMatch(/87-713|parties communes/i);
  });

  it('pickLegalClarificationProbe — serrure nuance clé vs usure', () => {
    const probe = pickLegalClarificationProbe({
      title: 'Porte bloquée',
      description:
        'Ma serrure ne tourne plus. Le bailleur dit que c est ma faute car j ai perdu une clé.',
      message: '',
      language: 'fr',
    });
    expect(probe?.probe.id).toBe('legal_clarify_serrure');
    expect(probe?.question).toMatch(/clé|cle|serrure|porte/i);
  });
});
