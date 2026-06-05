import type { LivingBuildingState, LivingSeverityZone } from './living-building-state.types';
import { tenantAlreadyDescribedElectricalHazard } from '../intake/lia-jarvis-signalement-scope';

function norm(raw: string): string {
  return raw.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

export function inferInitialSeverityFromSignalement(ctx: string): LivingSeverityZone {
  const t = norm(ctx);
  if (tenantAlreadyDescribedElectricalHazard(t)) return 'ZENITH_DANGER';
  if (
    /inond|refoul|eau\s+sale|urgence\s+eau|fuite\s+majeure/.test(t) &&
    /inond|refoul|debord/.test(t)
  ) {
    return 'ZENITH_DANGER';
  }
  return 'DAWN';
}

export function isLivingSafetyLockActive(state: LivingBuildingState): boolean {
  return (
    state.safetyLock.severityZone === 'ZENITH_DANGER' &&
    (state.safetyLock.requiresPowerCutoff || state.safetyLock.requiresWaterShutoff) &&
    !state.safetyLock.safetyVerified
  );
}

export function detectLivingSafetyVerified(tenantMessage: string): boolean {
  const t = norm(tenantMessage);
  if (!t.trim()) return false;
  return (
    /j.?ai coup[eé]|disjoncteur|plus de courant|courant coup|robinet.*ferm|eau coup|mis en s[eé]curit/.test(
      t,
    ) ||
    (/^(oui|ouais|c.?est fait|fait)\b/.test(t) && /coup|disjoncteur|eau|s[eé]cur/.test(t))
  );
}

export function applyLivingSafetyVerification(
  state: LivingBuildingState,
  tenantMessage: string,
): LivingBuildingState {
  if (!detectLivingSafetyVerified(tenantMessage)) return state;
  return {
    ...state,
    safetyLock: {
      ...state.safetyLock,
      safetyVerified: true,
      verifiedAt: new Date().toISOString(),
    },
    readiness: state.readiness === 'SAFETY_LOCK' ? 'DELIBERATING' : state.readiness,
    updatedAt: new Date().toISOString(),
  };
}

export const LIVING_SAFETY_LOCK_MAJORDOME = [
  '--- VERROU SÉCURITÉ (LOI ABSOLUE) ---',
  'safetyVerified est FALSE et severityZone est ZENITH_DANGER.',
  'Tu ne sors PAS de ce sujet : coupure courant ou eau, éloignement, sans toucher.',
  'Pas de diagnostic, pas de charge locataire, pas de « identifier la cause ».',
].join('\n');
