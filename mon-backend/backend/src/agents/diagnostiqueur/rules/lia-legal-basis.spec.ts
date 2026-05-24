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

  it('cite 87-712 pour électricité locative', () => {
    const line = resolveLegalBasisForVerdict({
      responsibility: 'LOCATAIRE',
      category: 'ELECTRICITY',
    });
    expect(line).toMatch(/87-712/);
    expect(line).toMatch(/ampoule|interrupteur|douille/i);
  });

  it('cite 87-712 pour menuiserie locative', () => {
    const line = resolveLegalBasisForVerdict({
      responsibility: 'LOCATAIRE',
      category: 'CARPENTRY',
    });
    expect(line).toMatch(/87-712/);
    expect(line).toMatch(/menuiserie|porte|entretien/i);
  });
});
