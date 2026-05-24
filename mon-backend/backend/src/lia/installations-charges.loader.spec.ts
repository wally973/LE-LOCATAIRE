import {
  formatInstallationsBrief,
  matchInstallationsFromText,
} from './installations-charges.loader';

describe('installations-charges.loader', () => {
  it('matche douche + siphon → bailleur', () => {
    const text = 'bac a douche siphon bouche eau stagne';
    const ids = matchInstallationsFromText(text).map((e) => e.id);
    expect(ids).toContain('plomberie_douche_receveur');
  });

  it('matche ampoule + encastré', () => {
    const text = 'lumiere salle de bain ampoule changee cablage encastre';
    const ids = matchInstallationsFromText(text).map((e) => e.id);
    expect(
      ids.some((id) =>
        ['elec_cablage_encastre', 'elec_ampoule_interrupteur_accessible'].includes(
          id,
        ),
      ),
    ).toBe(true);
  });

  it('produit un brief non vide', () => {
    const brief = formatInstallationsBrief('fuite sous evier siphon');
    expect(brief).toMatch(/Matrice installations/);
    expect(brief).toMatch(/evier|siphon/i);
  });
});
