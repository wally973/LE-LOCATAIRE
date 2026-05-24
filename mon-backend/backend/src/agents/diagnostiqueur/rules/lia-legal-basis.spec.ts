import { resolveLegalBasisForVerdict } from './lia-legal-basis';

describe('lia-legal-basis', () => {
  it('cite le décret 87-712 pour charge locataire', () => {
    const line = resolveLegalBasisForVerdict({
      responsibility: 'LOCATAIRE',
      category: 'PLUMBING',
    });
    expect(line).toMatch(/87-712/);
  });

  it('cite l’article 1719 pour charge bailleur', () => {
    const line = resolveLegalBasisForVerdict({
      responsibility: 'BAILLEUR',
      category: 'HUMIDITY',
    });
    expect(line).toMatch(/1719/);
  });
});
