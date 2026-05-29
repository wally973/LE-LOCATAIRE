import { inferHousingPerspective } from './lia-housing-perspective';

describe('lia-housing-perspective', () => {
  it('5F → collectif (chiffre + lettre)', () => {
    const h = inferHousingPerspective('5F');
    expect(h.kind).toBe('collective');
    expect(h.unitLabel).toBe('5F');
    expect(h.visualNote).toMatch(/collectif/i);
  });

  it('26 → plein pied (chiffre seul)', () => {
    const h = inferHousingPerspective('26');
    expect(h.kind).toBe('standalone');
    expect(h.visualNote).toMatch(/plein pied/i);
  });

  it('LOG-97300-000042 → plein pied', () => {
    const h = inferHousingPerspective('LOG-97300-000042');
    expect(h.kind).toBe('standalone');
  });

  it('vide → unknown', () => {
    const h = inferHousingPerspective('');
    expect(h.kind).toBe('unknown');
    expect(h.unitLabel).toBeNull();
  });
});
