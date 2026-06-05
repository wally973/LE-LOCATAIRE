import { createLivingBuildingState } from './living-building-state.factory';
import {
  applyProfessionalConsciousness,
  resolveTenantProfile,
  sanitizeTenantMessageForVulnerability,
  signalementImpliesPhysicalEffort,
} from './living-professional-consciousness';

describe('living-professional-consciousness', () => {
  it('sénior → isVulnerable', () => {
    const state = createLivingBuildingState({
      title: 'Ampoule',
      description: 'Plus de lumière salon',
      language: 'fr',
      ageBand: 'senior',
      livesAlone: true,
    });
    expect(state.tenantProfile.isVulnerable).toBe(true);
    expect(state.tenantProfile.reason).toMatch(/Sénior/);
  });

  it('override charge — ampoule + sénior → PATRIMOINE', () => {
    let state = createLivingBuildingState({
      title: 'Ampoule grillée',
      description: 'Je n’arrive plus à changer l’ampoule du plafonnier',
      language: 'fr',
      ageBand: 'senior',
    });
    state = {
      ...state,
      legalVerdict: { ...state.legalVerdict, chargeHorizon: 'LOCATIF' },
    };
    expect(signalementImpliesPhysicalEffort(state)).toBe(true);
    const applied = applyProfessionalConsciousness(state);
    expect(applied.legalVerdict.chargeHorizon).toBe('PATRIMOINE');
    expect(applied.consciousness.socialProtectionOverride).toBe(true);
  });

  it('sanitize — retire consigne physique dangereuse', () => {
    const state = createLivingBuildingState({
      title: 'Fuite',
      description: 'robinet',
      language: 'fr',
      ageBand: 'senior',
    });
    const msg = 'Marie, montez sur un escabeau et changez l’ampoule.';
    const safe = sanitizeTenantMessageForVulnerability(msg, {
      ...state,
      tenantProfile: resolveTenantProfile(state),
    });
    expect(safe).not.toMatch(/escabeau/i);
    expect(safe).toMatch(/technicien|sécurité|professionnel/i);
  });
});
