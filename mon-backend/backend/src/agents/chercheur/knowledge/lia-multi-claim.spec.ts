import {
  detectElectricityClaim,
  detectMultipleClaims,
} from './lia-multi-claim';

describe('detectElectricityClaim', () => {
  it('reconnaît pas de courant, prise et disjoncteur', () => {
    expect(
      detectElectricityClaim(
        "d'un coup j'ai pas de courant dans les prise de la cuisine",
      ),
    ).toBe(true);
    expect(detectElectricityClaim('undisjoncteur est vers le bas')).toBe(true);
    expect(detectElectricityClaim('court-circuit sur le tableau électrique')).toBe(
      true,
    );
  });

  it('classifie le signalement initial en électricité via detectMultipleClaims', () => {
    const title = "d'un coup j'ai pas de courant dans les prise de la cuisine";
    const claims = detectMultipleClaims(title, title);
    expect(claims.some((c) => c.category === 'ELECTRICITY')).toBe(true);
  });
});
