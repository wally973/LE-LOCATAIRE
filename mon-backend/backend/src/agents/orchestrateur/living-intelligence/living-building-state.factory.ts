import type { CompanionLanguage } from '../conversation/lia-companion.types';
import type { LivingBuildingState } from './living-building-state.types';
import { inferInitialSeverityFromSignalement } from './living-building-state.safety';
import { createOpenDossierIntegrity } from './living-dossier-integrity';
import { resolveTenantProfile } from './living-professional-consciousness';
import { createInitialSymmetricDeliberation, bumpStateToSymmetricLevel6 } from './living-symmetric.factory';
import { loadSymmetricDoctrine } from './living-symmetric-doctrine';
import { LIVING_TEAM_CHARTER_FR } from './living-team-roles';

export function createLivingBuildingState(params: {
  title: string;
  description: string;
  language: CompanionLanguage;
  tenantFirstName?: string;
  ageBand?: 'senior' | 'adult' | 'young' | 'unknown';
  livesAlone?: boolean;
  creolePreferred?: boolean;
}): LivingBuildingState {
  const ctx = `${params.title} ${params.description}`.trim();
  const severity = inferInitialSeverityFromSignalement(ctx);

  const doctrine = loadSymmetricDoctrine();
  const draft: LivingBuildingState = {
    schema: 'LIVING_BUILDING_STATE',
    version: 6,
    updatedAt: new Date().toISOString(),
    language: params.language,
    readiness: severity === 'ZENITH_DANGER' ? 'SAFETY_LOCK' : 'OPENING',
    signalementTitle: params.title,
    signalementDescription: params.description,
    tenantProfile: { isVulnerable: false, reason: 'Profil standard' },
    consciousness: {
      socialProtectionOverride: false,
      socialProtectionNote: null,
      constructiveDoubt: false,
      competingModels: [],
      internalNote: null,
      expertHandoffRequired: false,
      expertHandoffReason: null,
    },
    vision3d: {
      floorLevel: null,
      rooms: [],
      element: null,
      symptomAnchor: null,
      above: null,
      below: null,
      climate: 'tropical_humid',
      activeFlows: [],
      mentalModels: [],
      hypotheses: [],
    },
    humanBarrier: {
      displayName: params.tenantFirstName?.trim() || 'Marie',
      ageBand: params.ageBand ?? 'senior',
      livesAlone: params.livesAlone ?? true,
      preferredLanguage: params.language,
      creolePreferred: params.creolePreferred ?? params.language === 'gcf',
      vulnerabilityNotes: null,
      relationalTone: null,
      extractedFacts: {},
    },
    safetyLock: {
      severityZone: severity,
      hazardType: severity === 'ZENITH_DANGER' ? 'electrical' : 'none',
      requiresPowerCutoff: severity === 'ZENITH_DANGER',
      requiresWaterShutoff: false,
      safetyVerified: false,
      consigneGiven: false,
      verifiedAt: null,
    },
    legalVerdict: {
      chargeHorizon: 'INDETERMINE',
      articles: [],
      facts: [],
      summary: null,
      tenantChargeExplanation: null,
      afpolGrounding: null,
    },
    intervention: {
      tradeNeeded: null,
      partsToBring: [],
      toolsRequired: [],
      urgencyLabel: severity === 'ZENITH_DANGER' ? 'URGENT' : 'STANDARD',
      technicianSummary: null,
      readyForDispatch: false,
    },
    deliberationRound: 0,
    deliberationEchoes: [],
    savoirConsulted: [],
    dossierIntegrity: createOpenDossierIntegrity(),
    teamSymbiosis: {
      charter: doctrine.charter || LIVING_TEAM_CHARTER_FR,
      agents: [],
      updatedAt: new Date().toISOString(),
    },
    symmetricDeliberation: createInitialSymmetricDeliberation('locataire'),
    lastTenantMessage: null,
    reasoningSource: 'living_intelligence',
  };

  const profile = resolveTenantProfile(draft);
  return {
    ...draft,
    tenantProfile: profile,
    consciousness: {
      ...draft.consciousness,
      socialProtectionOverride: profile.isVulnerable,
      socialProtectionNote: profile.isVulnerable
        ? `Protection sociale — ${profile.reason}`
        : null,
    },
  };
}

export function parseLivingBuildingState(raw: unknown): LivingBuildingState | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as LivingBuildingState;
  if (o.schema !== 'LIVING_BUILDING_STATE') return null;
  const base = bumpStateToSymmetricLevel6({
    ...o,
    version: (o.version === 6 ? 6 : 3) as 3 | 6,
    savoirConsulted: Array.isArray(o.savoirConsulted) ? o.savoirConsulted : [],
    tenantProfile: o.tenantProfile ?? {
      isVulnerable: o.humanBarrier?.ageBand === 'senior',
      reason:
        o.humanBarrier?.ageBand === 'senior'
          ? 'Sénior (héritage état)'
          : 'Profil standard',
    },
    consciousness: o.consciousness ?? {
      socialProtectionOverride: false,
      socialProtectionNote: null,
      constructiveDoubt: false,
      competingModels: [],
      internalNote: null,
      expertHandoffRequired: false,
      expertHandoffReason: null,
    },
    legalVerdict: {
      ...o.legalVerdict,
      tenantChargeExplanation:
        o.legalVerdict?.tenantChargeExplanation ?? null,
      afpolGrounding: o.legalVerdict?.afpolGrounding ?? null,
    },
    dossierIntegrity: o.dossierIntegrity ?? createOpenDossierIntegrity(),
    teamSymbiosis: o.teamSymbiosis ?? {
      charter: LIVING_TEAM_CHARTER_FR,
      agents: [],
      updatedAt: new Date().toISOString(),
    },
    symmetricDeliberation:
      o.symmetricDeliberation ?? createInitialSymmetricDeliberation('locataire'),
  });
  return {
    ...base,
    tenantProfile: resolveTenantProfile(base),
  };
}

export function serializeLivingBuildingState(state: LivingBuildingState): string {
  return JSON.stringify(state);
}
