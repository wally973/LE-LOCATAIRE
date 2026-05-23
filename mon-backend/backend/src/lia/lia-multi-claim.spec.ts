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
});
