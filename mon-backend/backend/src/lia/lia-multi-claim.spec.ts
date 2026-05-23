import { detectMultipleClaims } from './lia-multi-claim';

describe('detectMultipleClaims', () => {
  it('détecte un seul sujet plomberie', () => {
    const claims = detectMultipleClaims(
      'Fuite',
      'Fuite sous l’évier depuis hier',
    );
    expect(claims.length).toBe(1);
    expect(claims[0].category).toBe('PLUMBING');
  });

  it('détecte WC + électricité dans une phrase', () => {
    const text = 'Fuite au WC et plus d’électricité dans la cuisine';
    const claims = detectMultipleClaims(text, text);
    expect(claims.length).toBe(2);
    const cats = claims.map((c) => c.category).sort();
    expect(cats).toEqual(['ELECTRICITY', 'PLUMBING']);
    const plumbing = claims.find((c) => c.category === 'PLUMBING')!;
    const electricity = claims.find((c) => c.category === 'ELECTRICITY')!;
    expect(plumbing.excerpt.toLowerCase()).toMatch(/wc|fuite/);
    expect(electricity.excerpt.toLowerCase()).toMatch(/[eé]lectri|cuisine/);
    expect(plumbing.excerpt).not.toBe(electricity.excerpt);
  });

  it('détecte trois sujets sur phrases séparées', () => {
    const text =
      'Fuite au WC. Plus de lumière dans le couloir. Infiltration sur la toiture.';
    const claims = detectMultipleClaims(text, text);
    expect(claims.length).toBe(3);
  });

  it('ne force pas de sujet sur texte vague', () => {
    const claims = detectMultipleClaims('Souci', 'Il y a un souci chez moi');
    expect(claims.length).toBe(0);
  });

  it('détecte ascenseur et chauffage comme sujets distincts', () => {
    const text =
      "L'ascenseur est bloqué et je n'ai plus de chauffage dans l'appartement";
    const claims = detectMultipleClaims(text, text);
    expect(claims.length).toBe(2);
    const labels = claims.map((c) => c.label);
    expect(labels).toContain('Parties communes / immeuble');
    expect(labels).toContain('Chauffage / radiateurs');
  });
});
