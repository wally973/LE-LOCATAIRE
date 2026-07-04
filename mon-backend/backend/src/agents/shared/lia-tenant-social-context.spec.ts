import { buildLabTenantSocialContext } from './lia-tenant-social-context';

describe('lia-tenant-social-context', () => {
  it('Marie — profil standard par défaut en Lia-Lab (pas d’inférence sénior)', () => {
    const social = buildLabTenantSocialContext({ tenantFirstName: 'Marie' });
    expect(social.ageBand).toBe('unknown');
    expect(social.relationalLandscape).toMatch(/interlocuteire locataire|respect/i);
    expect(social.relationalLandscape).not.toMatch(/senior/i);
  });

  it('technicien test — ton direct', () => {
    const social = buildLabTenantSocialContext({
      tenantFirstName: 'Luc',
      interlocutorRole: 'staff_tester',
      ageBand: 'adult',
    });
    expect(social.interlocutorRole).toBe('staff_tester');
    expect(social.relationalLandscape).toMatch(/direct|pair métier/i);
  });

  it('continuité — dossier clos injecté dans le paysage', () => {
    const social = buildLabTenantSocialContext({
      tenantFirstName: 'Marie',
      lastClosedTicketTitle: 'Prise buanderie',
      lastClosedTicketSummary: 'Électricien mandaté, attente retour chantier',
      currentTitle: 'Relance prise buanderie',
    });
    expect(social.lastClosedTicket?.title).toBe('Prise buanderie');
    expect(social.continuityLandscape).toMatch(/pas de faux|reprends le fil/i);
  });
});
