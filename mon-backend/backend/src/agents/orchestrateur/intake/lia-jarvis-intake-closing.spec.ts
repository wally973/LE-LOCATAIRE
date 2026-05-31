import { appendJarvisIntakeTransmission } from './lia-jarvis-dialogue.i18n';

describe('appendJarvisIntakeTransmission', () => {
  it('ajoute ticket transmis + technicien si absent', () => {
    const out = appendJarvisIntakeTransmission(
      'Marie, merci — je comprends que cela se produit depuis hier.',
      'fr',
    );
    expect(out).toMatch(/transmis au bailleur/i);
    expect(out).toMatch(/technicien.*recontacter/i);
  });

  it('ne double pas si déjà annoncé', () => {
    const msg =
      'Votre signalement est transmis. Un technicien va vous recontacter.';
    expect(appendJarvisIntakeTransmission(msg, 'fr')).toBe(msg);
  });
});
