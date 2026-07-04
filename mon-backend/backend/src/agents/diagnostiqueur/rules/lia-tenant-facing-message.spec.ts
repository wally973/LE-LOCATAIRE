import { buildTenantFacingMessage } from './lia-tenant-facing-message';

describe('buildTenantFacingMessage', () => {
  it('message bailleur simple sans artisan', () => {
    const msg = buildTenantFacingMessage({
      responsibility: 'BAILLEUR',
      category: 'ELECTRICITY',
      title: 'Chambre',
      description: 'pas de lumière',
      tenantFirstName: 'Marie',
      intake: { signals: { roomHint: 'chambre' } } as never,
    });
    expect(msg).toMatch(/charge du bailleur/i);
    expect(msg).toMatch(/recontactera/i);
    expect(msg).not.toMatch(/électricien partenaire/i);
    expect(msg).not.toMatch(/Synthèse de l’analyse/);
    expect(msg).not.toMatch(/Oui \/ Non/);
  });

  it('message bailleur eau/humidité avec conseil utile et assurance', () => {
    const msg = buildTenantFacingMessage({
      responsibility: 'BAILLEUR',
      category: 'HUMIDITY',
      title: 'Toiture / infiltration',
      description: 'infiltration dans la buanderie au plafond',
      tenantFirstName: 'Marie',
      intake: { signals: { roomHint: 'buanderie' } } as never,
    });

    expect(msg).toMatch(/charge du bailleur/i);
    expect(msg).toMatch(/plafond|d’au-dessus/i);
    expect(msg).toMatch(/assurance habitation/i);
    expect(msg).not.toMatch(/artisan partenaire/i);
    expect(msg).not.toMatch(/Synthèse de l’analyse/);
  });
});
