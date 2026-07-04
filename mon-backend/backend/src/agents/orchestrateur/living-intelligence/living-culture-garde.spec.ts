import {
  DOCTRINE_IDENTIFIED_LABEL,
  applyLiaCultureGarde,
  buildPaulAutoCulturePack,
  filterQuestionsAntiLoop,
  isTenantIgnorance,
  questionAlreadyAsked,
} from './living-culture-garde';

describe('living-culture-garde', () => {
  it('détecte l ignorance locataire (réponse courte / je ne sais pas)', () => {
    expect(isTenantIgnorance('Non rien, simplement que c\'est levé')).toBe(true);
    expect(isTenantIgnorance('Je ne sais pas')).toBe(true);
    expect(
      isTenantIgnorance(
        'C\'est du béton plein sous le carrelage depuis la construction en 2010',
      ),
    ).toBe(false);
  });

  it('Paul auto-culture sur carrelage — fiches AFPOL', () => {
    const pack = buildPaulAutoCulturePack(
      'Carrelage chambre fils carreaux levés dalle sol',
    );
    expect(pack.structural).toBe(true);
    expect(pack.hypotheses.length).toBeGreaterThan(0);
    expect(pack.brief).toMatch(/AUTO-CULTURE PAUL/i);
  });

  it('interdit de reposer la même question technique', () => {
    const history = [
      'Votre carrelage est-il posé sur une dalle pleine ou y a-t-il un vide sanitaire ?',
    ];
    expect(
      questionAlreadyAsked(
        'Y a-t-il un vide sanitaire sous le carrelage ?',
        history,
      ),
    ).toBe(true);
    const filtered = filterQuestionsAntiLoop(
      [
        'Votre carrelage est-il posé sur une dalle pleine ou y a-t-il un vide sanitaire ?',
        'Quelle est la surface touchée ?',
      ],
      history,
    );
    expect(filtered).toEqual(['Quelle est la surface touchée ?']);
  });

  it('marque IDENTIFIÉE PAR DOCTRINE quand Marie ne sait pas', () => {
    const out = applyLiaCultureGarde({
      displayName: 'Marie',
      tenantMessage: 'Non rien simplement que c\'est levé',
      tenantParole: 'Marie, dalle ou vide sanitaire ?',
      parsed: {
        questions_complement_dessin: [
          'Votre carrelage est-il sur dalle pleine ou vide sanitaire ?',
        ],
      },
      askedQuestions: [
        'Votre carrelage est-il sur dalle pleine ou vide sanitaire ?',
      ],
      doctrineVariables: {},
      contextText:
        'Carrelage chambre fils carreaux levés cassé',
      lastLiaQuestion:
        'Votre carrelage est-il sur dalle pleine ou vide sanitaire ?',
    });
    expect(Object.values(out.doctrineVariables)[0]).toContain(
      DOCTRINE_IDENTIFIED_LABEL,
    );
    expect(out.tenantParole).not.toMatch(/vide sanitaire\s*\?/i);
    expect(out.tenantParole).toMatch(/retient|retenir|pistes|probables/i);
  });
});
