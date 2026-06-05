/**
 * Instruments de Bord — le Majordome consulte les experts AVANT de parler.
 */
import type { LivingBuildingState, LivingDeliberationEcho } from './living-building-state.types';
import { tripleFluxToDisplayLabel } from '../../../ai/lia-triple-flux-charge';

export interface LivingInstrumentsBoard {
  updatedAt: string;
  enqueteurInsight: string | null;
  archivisteInsight: string | null;
  majordomeFactsInsight: string | null;
  activeFlows: string[];
  mentalModels: string[];
  chargeHorizon: string;
  tradeNeeded: string | null;
  socialProtection: string | null;
  constructiveDoubt: string | null;
  savoirCount: number;
  /** Synthèse lisible pour le prompt Majordome (pas pour le locataire). */
  pilotBrief: string;
}

export function buildInstrumentsBoard(
  state: LivingBuildingState,
  echoes: LivingDeliberationEcho[],
  expertReports?: {
    enqueteur?: Record<string, unknown> | null;
    archiviste?: Record<string, unknown> | null;
    majordome?: Record<string, unknown> | null;
  },
): LivingInstrumentsBoard {
  const last = (agent: LivingDeliberationEcho['agent']) =>
    [...echoes].reverse().find((e) => e.agent === agent)?.insight ??
    state.deliberationEchoes.filter((e) => e.agent === agent).at(-1)?.insight ??
    null;

  const doctrineLesson = [
    expertReports?.enqueteur?.doctrineLesson,
    expertReports?.archiviste?.doctrineLesson,
  ]
    .filter((x) => typeof x === 'string' && String(x).trim())
    .join(' · ');

  const pilotBrief = [
    '=== INSTRUMENTS DE BORD (lire avant de parler) ===',
    `Flux actifs : ${state.vision3d.activeFlows.join(' · ') || '—'}`,
    `Modèles mentaux : ${state.vision3d.mentalModels.join(' · ') || '—'}`,
    `Métier : ${state.intervention.tradeNeeded ?? '—'}`,
    `Charge : ${tripleFluxToDisplayLabel(state.legalVerdict.chargeHorizon)}`,
    state.legalVerdict.tenantChargeExplanation
      ? `Conseil charge : ${state.legalVerdict.tenantChargeExplanation}`
      : '',
    state.tenantProfile.isVulnerable
      ? `Protection sociale : ${state.tenantProfile.reason}`
      : '',
    state.consciousness.constructiveDoubt
      ? `Doute interne : ${state.consciousness.competingModels.join(' · ') || 'oui'}`
      : '',
    last('enqueteur') ? `Enquêteur : ${last('enqueteur')}` : '',
    last('archiviste') ? `Archiviste : ${last('archiviste')}` : '',
    last('majordome') ? `Extraction Marie : ${last('majordome')}` : '',
    doctrineLesson ? `Leçon doctrine : ${doctrineLesson}` : '',
    `Savoir consulté : ${state.savoirConsulted?.length ?? 0} source(s)`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    updatedAt: new Date().toISOString(),
    enqueteurInsight: last('enqueteur'),
    archivisteInsight: last('archiviste'),
    majordomeFactsInsight: last('majordome'),
    activeFlows: state.vision3d.activeFlows,
    mentalModels: state.vision3d.mentalModels,
    chargeHorizon: tripleFluxToDisplayLabel(state.legalVerdict.chargeHorizon),
    tradeNeeded: state.intervention.tradeNeeded,
    socialProtection: state.consciousness.socialProtectionNote,
    constructiveDoubt: state.consciousness.internalNote,
    savoirCount: state.savoirConsulted?.length ?? 0,
    pilotBrief,
  };
}
