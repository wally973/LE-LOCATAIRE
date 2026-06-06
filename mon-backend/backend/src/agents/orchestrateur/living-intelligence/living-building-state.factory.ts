import type { CompanionLanguage } from '../conversation/lia-companion.types';
import type { LivingBuildingState } from './living-building-state.types';
import { createOpenDossierIntegrity } from './living-dossier-integrity';
import { createInitialSymmetricDeliberation, bumpStateToSymmetricLevel6 } from './living-symmetric.factory';
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
  const draft: LivingBuildingState = {
    schema: 'LIVING_BUILDING_STATE',
    version: 6,
    updatedAt: new Date().toISOString(),
    language: params.language,
    readiness: 'OPENING',
    signalementTitle: params.title,
    signalementDescription: params.description,
    tenantProfile: {
      isVulnerable: false,
      reason: 'Tabula rasa — profil lu par les agents',
    },
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
      severityZone: 'DAWN',
      hazardType: 'none',
      requiresPowerCutoff: false,
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
      urgencyLabel: 'STANDARD',
      technicianSummary: null,
      readyForDispatch: false,
    },
    deliberationRound: 0,
    deliberationEchoes: [],
    savoirConsulted: [],
    dossierIntegrity: createOpenDossierIntegrity(),
    teamSymbiosis: {
      charter: LIVING_TEAM_CHARTER_FR,
      agents: [],
      updatedAt: new Date().toISOString(),
    },
    symmetricDeliberation: createInitialSymmetricDeliberation('locataire'),
    lastTenantMessage: null,
    reasoningSource: 'living_intelligence',
  };

  return draft;
}

export function parseLivingBuildingState(raw: unknown): LivingBuildingState | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as LivingBuildingState;
  if (o.schema !== 'LIVING_BUILDING_STATE') return null;
  return bumpStateToSymmetricLevel6({
    ...o,
    version: (o.version === 6 ? 6 : 3) as 3 | 6,
    savoirConsulted: Array.isArray(o.savoirConsulted) ? o.savoirConsulted : [],
    tenantProfile: o.tenantProfile ?? {
      isVulnerable: false,
      reason: 'Tabula rasa — profil lu par les agents',
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
}

export function serializeLivingBuildingState(state: LivingBuildingState): string {
  return JSON.stringify(state);
}
