import {
  createLivingBuildingState,
  parseLivingBuildingState,
} from './living-building-state.factory';
import {
  applyLivingSafetyVerification,
  inferInitialSeverityFromSignalement,
  isLivingSafetyLockActive,
} from './living-building-state.safety';
import { nuclearFlushLivingState, nuclearFlushJarvisFacts } from './living-tabula-rasa';
import { isLivingIntelligenceEnabled } from './living-intelligence.config';

describe('living-intelligence — LIVING_BUILDING_STATE', () => {
  it('isLivingIntelligenceEnabled — false sans GROQ_API_KEY', () => {
    const prev = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;
    expect(isLivingIntelligenceEnabled()).toBe(false);
    if (prev) process.env.GROQ_API_KEY = prev;
  });

  it('factory Tabula Rasa — DAWN neutre (pas de pré-classification)', () => {
    const state = createLivingBuildingState({
      title: 'Électricité',
      description: 'prises arrachées grésillement',
      language: 'fr',
    });
    expect(state.safetyLock.severityZone).toBe('DAWN');
    expect(isLivingSafetyLockActive(state)).toBe(false);
  });

  it('inferInitialSeverityFromSignalement — module sécurité isolé', () => {
    const zone = inferInitialSeverityFromSignalement(
      'Une prise du salon est arrachée et ça grésille',
    );
    expect(zone).toBe('ZENITH_DANGER');
  });

  it('nuclearFlushLivingState — vide vision, intervention et faits extraits', () => {
    let state = createLivingBuildingState({
      title: 'Fuite',
      description: 'lavabo',
      language: 'fr',
    });
    state = {
      ...state,
      vision3d: { ...state.vision3d, activeFlows: ['eau'], mentalModels: ['Plomberie'] },
      intervention: { ...state.intervention, tradeNeeded: 'Plombier' },
      humanBarrier: {
        ...state.humanBarrier,
        extractedFacts: { room: 'cuisine' },
      },
      deliberationRound: 3,
    };
    const flushed = nuclearFlushLivingState(state);
    expect(flushed.vision3d.activeFlows).toEqual([]);
    expect(flushed.intervention.tradeNeeded).toBeNull();
    expect(flushed.humanBarrier.extractedFacts).toEqual({});
    expect(flushed.deliberationRound).toBe(0);
  });

  it('nuclearFlushJarvisFacts — purge clés legacy', () => {
    const out = nuclearFlushJarvisFacts({
      langue_choisie: 'oui',
      perception_metier: 'ghost',
      trade_override: 'Plombier',
    });
    expect(out.langue_choisie).toBe('oui');
    expect(out.perception_metier).toBeUndefined();
    expect(out.trade_override).toBeUndefined();
  });

  it('confirmation coupure → safetyVerified (module sécurité)', () => {
    let state = createLivingBuildingState({
      title: 'Électricité',
      description: 'prises arrachées',
      language: 'fr',
    });
    state = {
      ...state,
      safetyLock: {
        ...state.safetyLock,
        severityZone: 'ZENITH_DANGER',
        requiresPowerCutoff: true,
      },
    };
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
