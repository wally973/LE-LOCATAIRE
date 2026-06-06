import type {
  LivingBuildingState,
  LivingDeliberationEcho,
  LivingLegalVerdict,
  LivingVision3D,
} from './living-building-state.types';
import { sealDossierIntegrity } from './living-dossier-integrity';
import { buildTeamSymbiosisSnapshot } from './living-team-roles';
import { captureDoctrineLessonsFromPatches, toPendingDoctrineRecords } from './living-doctrine-stylo';

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

function asString(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}

/** Fusionne les patches LLM — sans rails métier/juridiques post-traités. */
export function mergeLivingPatches(
  base: LivingBuildingState,
  patches: {
    enqueteur?: Record<string, unknown> | null;
    archiviste?: Record<string, unknown> | null;
    majordome?: Record<string, unknown> | null;
  },
  echoes: LivingDeliberationEcho[],
  sessionRef?: string,
): { state: LivingBuildingState; pendingDoctrineLessons: import('./living-building-state.types').LivingPendingDoctrineLesson[] } {
  let state = { ...base, updatedAt: new Date().toISOString() };

  const enq = patches.enqueteur;
  if (enq) {
    const v = asRecord(enq.vision3d);
    if (v) {
      state.vision3d = {
        ...state.vision3d,
        floorLevel: asString(v.floorLevel) || state.vision3d.floorLevel,
        rooms: asStringArray(v.rooms).length ? asStringArray(v.rooms) : state.vision3d.rooms,
        element: asString(v.element) || state.vision3d.element,
        symptomAnchor: asString(v.symptomAnchor) || state.vision3d.symptomAnchor,
        above: asString(v.above) || state.vision3d.above,
        below: asString(v.below) || state.vision3d.below,
        climate:
          (asString(v.climate) as LivingVision3D['climate']) || state.vision3d.climate,
        activeFlows: asStringArray(v.activeFlows).length
          ? asStringArray(v.activeFlows)
          : state.vision3d.activeFlows,
        mentalModels: asStringArray(v.mentalModels).length
          ? asStringArray(v.mentalModels)
          : state.vision3d.mentalModels,
        hypotheses: Array.isArray(v.hypotheses)
          ? (v.hypotheses as LivingVision3D['hypotheses'])
          : state.vision3d.hypotheses,
      };
    }
    const int = asRecord(enq.intervention);
    if (int) {
      state.intervention = {
        ...state.intervention,
        tradeNeeded: asString(int.tradeNeeded) || state.intervention.tradeNeeded,
        partsToBring: asStringArray(int.partsToBring).length
          ? asStringArray(int.partsToBring)
          : state.intervention.partsToBring,
        toolsRequired: asStringArray(int.toolsRequired).length
          ? asStringArray(int.toolsRequired)
          : state.intervention.toolsRequired,
        urgencyLabel: asString(int.urgencyLabel) || state.intervention.urgencyLabel,
        technicianSummary:
          asString(int.technicianSummary) || state.intervention.technicianSummary,
        readyForDispatch:
          int.readyForDispatch === true || state.intervention.readyForDispatch,
      };
    }
    const saf = asRecord(enq.safetyLock);
    if (saf) {
      const zone = asString(saf.severityZone);
      state.safetyLock = {
        ...state.safetyLock,
        severityZone:
          zone === 'ZENITH_DANGER' ||
          zone === 'MIDDAY_CLARITY' ||
          zone === 'TWILIGHT' ||
          zone === 'DAWN'
            ? zone
            : state.safetyLock.severityZone,
        hazardType:
          (asString(saf.hazardType) as LivingBuildingState['safetyLock']['hazardType']) ||
          state.safetyLock.hazardType,
        requiresPowerCutoff:
          saf.requiresPowerCutoff === true || state.safetyLock.requiresPowerCutoff,
        requiresWaterShutoff:
          saf.requiresWaterShutoff === true || state.safetyLock.requiresWaterShutoff,
      };
      if (
        state.safetyLock.severityZone === 'ZENITH_DANGER' &&
        !state.safetyLock.safetyVerified
      ) {
        state.readiness = 'SAFETY_LOCK';
      }
    }
  }

  const arch = patches.archiviste;
  if (arch) {
    const lv = asRecord(arch.legalVerdict);
    if (lv) {
      state.legalVerdict = {
        ...state.legalVerdict,
        chargeHorizon:
          (asString(lv.chargeHorizon) as LivingLegalVerdict['chargeHorizon']) ||
          state.legalVerdict.chargeHorizon,
        articles: Array.isArray(lv.articles)
          ? (lv.articles as LivingLegalVerdict['articles'])
          : state.legalVerdict.articles,
        facts: Array.isArray(lv.facts)
          ? (lv.facts as LivingLegalVerdict['facts'])
          : state.legalVerdict.facts,
        summary: asString(lv.summary) || state.legalVerdict.summary,
        tenantChargeExplanation:
          asString(lv.tenantChargeExplanation) ||
          state.legalVerdict.tenantChargeExplanation,
      };
    }
  }

  const maj = patches.majordome;
  if (maj) {
    const hb = asRecord(maj.humanBarrier);
    if (hb) {
      const facts = asRecord(hb.extractedFacts);
      state.humanBarrier = {
        ...state.humanBarrier,
        relationalTone: asString(hb.relationalTone) || state.humanBarrier.relationalTone,
        vulnerabilityNotes:
          asString(hb.vulnerabilityNotes) || state.humanBarrier.vulnerabilityNotes,
        extractedFacts: facts
          ? {
              ...state.humanBarrier.extractedFacts,
              ...Object.fromEntries(
                Object.entries(facts).map(([k, v]) => [k, asString(v)]),
              ),
            }
          : state.humanBarrier.extractedFacts,
      };
    }
    if (maj.consigneGiven === true) {
      state.safetyLock = { ...state.safetyLock, consigneGiven: true };
    }
  }

  state.deliberationRound += 1;
  state.deliberationEchoes = [...state.deliberationEchoes, ...echoes].slice(-24);

  const capturedDoctrine = captureDoctrineLessonsFromPatches(patches, sessionRef);
  const pendingDoctrine = toPendingDoctrineRecords(capturedDoctrine);

  if (state.intervention.readyForDispatch || state.consciousness.expertHandoffRequired) {
    state.readiness = 'READY_FOR_TECHNICIAN';
  }

  const lastInsight = (agent: LivingDeliberationEcho['agent']) =>
    [...state.deliberationEchoes].reverse().find((e) => e.agent === agent)?.insight;

  state.teamSymbiosis = {
    ...buildTeamSymbiosisSnapshot({
      enqueteur: lastInsight('enqueteur'),
      archiviste: lastInsight('archiviste'),
      majordome: lastInsight('majordome'),
    }),
    updatedAt: new Date().toISOString(),
  };

  state = sealDossierIntegrity(state);

  return { state, pendingDoctrineLessons: pendingDoctrine };
}
