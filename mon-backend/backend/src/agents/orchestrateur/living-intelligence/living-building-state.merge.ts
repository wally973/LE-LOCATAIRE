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
      const pick = (key: keyof typeof state.vision3d) => {
        if (!(key in v)) return state.vision3d[key];
        const raw = v[key as string];
        if (raw == null || raw === '') return null;
        if (key === 'rooms') return asStringArray(raw);
        if (key === 'hypotheses' && Array.isArray(raw)) return raw as typeof state.vision3d.hypotheses;
        if (key === 'activeFlows' || key === 'mentalModels') return asStringArray(raw);
        if (key === 'climate') {
          const c = asString(raw);
          return c === 'tropical_humid' || c === 'dry_season' ? c : state.vision3d.climate;
        }
        return asString(raw) || null;
      };
      state.vision3d = {
        ...state.vision3d,
        floorLevel: pick('floorLevel') as string | null,
        rooms: pick('rooms') as string[],
        element: pick('element') as string | null,
        symptomAnchor: pick('symptomAnchor') as string | null,
        above: pick('above') as string | null,
        below: pick('below') as string | null,
        climate: pick('climate') as LivingVision3D['climate'],
        activeFlows: pick('activeFlows') as string[],
        mentalModels: pick('mentalModels') as string[],
        hypotheses: pick('hypotheses') as LivingVision3D['hypotheses'],
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
    const qPaul = asString(arch.questionPourPaul);
    if (qPaul) {
      state = {
        ...state,
        symmetricDeliberation: state.symmetricDeliberation
          ? {
              ...state.symmetricDeliberation,
              contradictionActive: true,
              contradictionNote: `Pierre → Paul : ${qPaul}`,
            }
          : state.symmetricDeliberation,
      };
    }
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

  state.teamSymbiosis = buildTeamSymbiosisSnapshot({
    enqueteur: lastInsight('enqueteur'),
    archiviste: lastInsight('archiviste'),
    majordome: lastInsight('majordome'),
  });

  state = sealDossierIntegrity(state);

  return { state, pendingDoctrineLessons: pendingDoctrine };
}
