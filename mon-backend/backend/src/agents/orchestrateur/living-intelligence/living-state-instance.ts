/**
 * Niveau 7 — destruction physique LIVING_BUILDING_STATE.
 * Nouvel ID d'instance à chaque conversation ; pas de spread des jarvisFacts résiduels.
 */
import { randomUUID } from 'crypto';
import type { CompanionLanguage } from '../conversation/lia-companion.types';
import type { LivingBuildingState } from './living-building-state.types';
import {
  serializeLivingBuildingState,
  createLivingBuildingState,
} from './living-building-state.factory';
import { LIVING_STATE_JARVIS_KEY } from './living-building-state.repository';
import { nuclearFlushLivingState, rebindSignalement } from './living-tabula-rasa';
import { createInitialSymmetricDeliberation } from './living-symmetric.factory';

export const STATE_INSTANCE_JARVIS_KEY = 'living_state_instance_id';

/** Clés jarvisFacts autorisées après destruction physique — profil locataire uniquement. */
export const JARVIS_PROFILE_ALLOWLIST = new Set([
  'langue_choisie',
  'housing_unit',
  'housing_kind',
  'housing_visual',
  'tenant_age_band',
  'tenant_interlocutor_role',
  'tenant_last_closed_summary',
  'tenant_last_closed_title',
  LIVING_STATE_JARVIS_KEY,
  STATE_INSTANCE_JARVIS_KEY,
  'reasoning_source',
  'lia_lab_isolated',
  'flux_persistence',
  'premier_pignon_cube',
  'lia_questions_posees',
  'doctrine_variables',
]);

export function newStateInstanceId(): string {
  return randomUUID();
}

/** État neuf avec ID d'instance unique — aucun héritage cognitif. */
export function physicallyRecreateLivingState(params: {
  title: string;
  description: string;
  language: CompanionLanguage;
  tenantFirstName?: string;
  ageBand?: 'senior' | 'adult' | 'young' | 'unknown';
  livesAlone?: boolean;
  creolePreferred?: boolean;
  interlocutorFace?: 'locataire' | 'technicien' | 'bailleur' | 'equipe_test';
}): LivingBuildingState {
  const stateInstanceId = newStateInstanceId();
  const face = params.interlocutorFace ?? 'locataire';
  const draft = createLivingBuildingState({
    title: params.title,
    description: params.description,
    language: params.language,
    tenantFirstName: params.tenantFirstName,
    ageBand: params.ageBand,
    livesAlone: params.livesAlone,
    creolePreferred: params.creolePreferred,
  });
  const flushed = nuclearFlushLivingState({
    ...draft,
    stateInstanceId,
    guardianReview: null,
    doctrinePending: [],
    cyberGardienAudit: null,
    symmetricDeliberation: createInitialSymmetricDeliberation(face),
  });
  return rebindSignalement(flushed, params.title, params.description);
}

/**
 * Réécrit jarvisFacts sans spread résiduel — destruction logique alignée Supabase NULL → INSERT.
 */
export function physicallyRecreateJarvisFacts(
  prior: Record<string, string> | undefined,
  state: LivingBuildingState,
): Record<string, string> {
  const instanceId = state.stateInstanceId ?? newStateInstanceId();
  const sealed: LivingBuildingState = { ...state, stateInstanceId: instanceId };
  const out: Record<string, string> = {
    [LIVING_STATE_JARVIS_KEY]: serializeLivingBuildingState(sealed),
    [STATE_INSTANCE_JARVIS_KEY]: instanceId,
    reasoning_source: 'living_intelligence',
  };
  if (prior) {
    for (const key of JARVIS_PROFILE_ALLOWLIST) {
      if (key === LIVING_STATE_JARVIS_KEY || key === STATE_INSTANCE_JARVIS_KEY) continue;
      const v = prior[key];
      if (v != null && String(v).trim()) {
        out[key] = String(v).trim();
      }
    }
  }
  return out;
}
