import {
  createLivingBuildingState,
  parseLivingBuildingState,
} from './living-building-state.factory';
import {
  applyLivingSafetyVerification,
  inferInitialSeverityFromSignalement,
  isLivingSafetyLockActive,
} from './living-building-state.safety';
import { isLivingIntelligenceEnabled } from './living-intelligence.config';

describe('living-intelligence — LIVING_BUILDING_STATE', () => {
  it('isLivingIntelligenceEnabled — false sans GROQ_API_KEY', () => {
    const prev = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;
    expect(isLivingIntelligenceEnabled()).toBe(false);
    if (prev) process.env.GROQ_API_KEY = prev;
  });

  it('prise arrachée + grésillement → ZENITH_DANGER et verrou actif', () => {
    const zone = inferInitialSeverityFromSignalement(
      'Une prise du salon est arrachée et ça grésille',
    );
    expect(zone).toBe('ZENITH_DANGER');
    const state = createLivingBuildingState({
      title: 'Électricité',
      description: 'prises arrachées grésillement',
      language: 'fr',
    });
    expect(isLivingSafetyLockActive(state)).toBe(true);
  });

  it('confirmation coupure → safetyVerified', () => {
    let state = createLivingBuildingState({
      title: 'Électricité',
      description: 'prises arrachées',
      language: 'fr',
    });
    state = applyLivingSafetyVerification(state, "j'ai coupé le disjoncteur");
    expect(state.safetyLock.safetyVerified).toBe(true);
    expect(isLivingSafetyLockActive(state)).toBe(false);
  });

  it('parseLivingBuildingState — schéma strict', () => {
    const raw = createLivingBuildingState({
      title: 'Fuite',
      description: 'lavabo',
      language: 'fr',
    });
    expect(parseLivingBuildingState(raw)?.schema).toBe('LIVING_BUILDING_STATE');
    expect(parseLivingBuildingState({ foo: 1 })).toBeNull();
  });
});
