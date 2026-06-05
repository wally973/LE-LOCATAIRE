import { loadSymmetricDoctrine, SYMMETRIC_LEVEL } from './living-symmetric-doctrine';
import type { LivingSymmetricDeliberation } from './living-building-state.types';
import { LIVING_TEAM_CHARTER_FR } from './living-team-roles';
import type { LivingBuildingState } from './living-building-state.types';

export function createInitialSymmetricDeliberation(
  face: LivingSymmetricDeliberation['interlocutorFace'] = 'locataire',
): LivingSymmetricDeliberation {
  return {
    level: SYMMETRIC_LEVEL,
    interlocutorFace: face,
    instrumentsBoard: {
      updatedAt: new Date().toISOString(),
      enqueteurInsight: null,
      archivisteInsight: null,
      majordomeFactsInsight: null,
      activeFlows: [],
      mentalModels: [],
      chargeHorizon: 'INDETERMINE',
      tradeNeeded: null,
      socialProtection: null,
      constructiveDoubt: null,
      savoirCount: 0,
      pilotBrief: 'Instruments de bord — en attente de délibération.',
    },
    expertReports: {
      enqueteur: null,
      archiviste: null,
      majordomeFacts: null,
    },
    contradictionActive: false,
    contradictionNote: null,
    doctrineVersion: `symmetric-${SYMMETRIC_LEVEL}`,
  };
}

export function bumpStateToSymmetricLevel6(
  state: LivingBuildingState,
  face?: LivingSymmetricDeliberation['interlocutorFace'],
): LivingBuildingState {
  const doctrine = loadSymmetricDoctrine();
  return {
    ...state,
    version: 6,
    symmetricDeliberation: state.symmetricDeliberation ?? createInitialSymmetricDeliberation(face),
    teamSymbiosis: {
      ...state.teamSymbiosis,
      charter: doctrine.charter || LIVING_TEAM_CHARTER_FR,
    },
  };
}
