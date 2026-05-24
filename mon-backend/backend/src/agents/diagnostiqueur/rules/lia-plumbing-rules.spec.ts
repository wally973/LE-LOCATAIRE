import {
  isEmbeddedPlumbing,
  isShowerInaccessibleDrain,
  resolvePlumbingCharge,
} from './lia-plumbing-rules';

describe('lia-plumbing-rules', () => {
  it('canalisation encastrée → bailleur', () => {
    expect(
      resolvePlumbingCharge('fuite sur canalisation encastrée salle de bain'),
    ).toBe('BAILLEUR');
    expect(isEmbeddedPlumbing('colonne qui fuit')).toBe(true);
  });

  it('bac à douche sans trappe, siphon → bailleur', () => {
    const text =
      'bac a douche sans trappe de visite le siphon est bouche l eau ne s ecoule pas';
    expect(isShowerInaccessibleDrain(text)).toBe(true);
    expect(resolvePlumbingCharge(text)).toBe('BAILLEUR');
  });

  it('douche + problème siphon (même sans mention trappe) → bailleur', () => {
    const text = 'douche siphon bouche eau stagne dans le bac';
    expect(resolvePlumbingCharge(text)).toBe('BAILLEUR');
  });

  it('évier accessible sans encastré → pas de règle bailleur ici', () => {
    expect(resolvePlumbingCharge('fuite sous evier siphon robinet')).toBeNull();
  });
});
