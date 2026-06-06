/**
 * Visualisation Lia-Lab — LIVING_BUILDING_STATE uniquement.
 */
import { labelDialogueLanguageFr } from '../agents/shared/lia-dialogue-languages';
import type { CompanionLanguage } from '../agents/orchestrateur/conversation/lia-companion.types';
import { readLivingStateFromIntake } from '../agents/orchestrateur/living-intelligence/living-building-state.repository';
import type {
  LivingBuildingState,
  LivingTeamAgentCard,
} from '../agents/orchestrateur/living-intelligence/living-building-state.types';
import {
  ARCHIVISTE_ROLE,
  ENQUETEUR_ROLE,
  MAJORDOME_ROLE,
} from '../agents/orchestrateur/living-intelligence/living-team-roles';
import { tripleFluxToDisplayLabel } from '../ai/lia-triple-flux-charge';
import type { LiaIntakeState } from '../agents/orchestrateur/intake/lia-intake.service';

export interface LiaLabSafetyOverride {
  forceKind: string;
  priority: string;
  shieldStatus: string;
  shieldDelivered: boolean;
  surgicalProbe: string | null;
  ticketSummary: string | null;
  investigationPhase: string | null;
}

export interface LiaLabSceneRow {
  label: string;
  value: string;
}

export interface LiaLabFactRow {
  label: string;
  value: string;
}

export interface LiaLabSavoirSourceRow {
  agent: string;
  agentLabel: string;
  corpus: string;
  ref: string;
  title: string;
  url?: string;
  label: string;
  relevance: number;
  hypothesisLabel?: string;
}

export interface LiaLabVisualization {
  mentalModels: string[];
  activeFlows: string[];
  activeFlowLabels: string[];
  detectedLot: string;
  urgencyMode: string | null;
  safetyOverride: LiaLabSafetyOverride | null;
  language: CompanionLanguage;
  dialogueLanguageLabel: string;
  consoleLanguage: 'fr';
  jarvisFacts: Record<string, string>;
  jarvisFactsConsole: LiaLabFactRow[];
  visualizationNote: string | null;
  kbPanneId: string | null;
  kbPanneLabel: string | null;
  kbCausesActive: string[];
  kbCausesEliminated: string[];
  afpolRefs: string[];
  intakePhase: string;
  intakePhaseLabel: string;
  handoffRecommended: boolean;
  tenantLanguage?: string;
  tenantLanguageLabel?: string;
  simulationDomain: string | null;
  simulationDomainLabel: string | null;
  scene3D: Record<string, string | null>;
  scene3DRows: LiaLabSceneRow[];
  physicalHypotheses: string[];
  /** Échos délibération parallèle — Majordome · Enquêteur · Archiviste */
  councilEchoes: { agent: string; heard: string; insight: string }[];
  housingPerspective: string | null;
  livingBuildingState: LivingBuildingState | null;
  livingStateConsole: LiaLabFactRow[];
  /** Sources @knowledge / legal-references consultées ce tour */
  savoirSources: LiaLabSavoirSourceRow[];
  /** Conscience professionnelle Niveau 5 */
  consciousnessConsole: LiaLabFactRow[];
  /** Équipe experts — cartes rôles + derniers insights */
  teamSymbiosis: {
    charter: string;
    agents: LivingTeamAgentCard[];
    dossierSealed: boolean;
    primaryTrade: string | null;
  };
  /** Niveau 6 — instruments de bord + prisme */
  symmetricConsole: LiaLabFactRow[];
  instrumentsPilotBrief: string | null;
  /** Phase B — Gardien souverain */
  guardianConsole?: { label: string; value: string }[];
  guardianMurmures?: string[];
}

const PHASE_LABELS_FR: Record<string, string> = {
  INTAKE: 'Intake en cours',
  AWAITING_PHOTO: 'En attente photo',
  DONE: 'Dossier transmis',
};

const SCENE_LABELS_FR: Record<string, string> = {
  climate: 'Climat',
  floorLevel: 'Niveau',
  room: 'Pièce',
  above: 'Au-dessus',
  below: 'En dessous',
  element: 'Élément',
  symptomAnchor: 'Symptôme',
};

function buildScene3DRows(scene3D: Record<string, string | null>): LiaLabSceneRow[] {
  return Object.entries(scene3D)
    .filter(([, v]) => v != null && String(v).trim())
    .map(([k, v]) => ({
      label: SCENE_LABELS_FR[k] ?? k,
      value: String(v),
    }));
}

export function buildLabVisualization(params: {
  state: LiaIntakeState;
  title: string;
  description: string;
  lastMessage?: string;
}): LiaLabVisualization {
  const living =
    readLivingStateFromIntake(params.state.jarvisFacts) ??
    emptyLivingFallback(params);

  const safetyOverride =
    living.safetyLock.severityZone === 'ZENITH_DANGER'
      ? {
          forceKind: 'living_zenith_danger',
          priority: 'CRITICAL',
          shieldStatus: living.safetyLock.safetyVerified
            ? 'DELIVRÉ — safetyVerified'
            : 'VERROU ACTIF — Majordome bloqué sur sécurité',
          shieldDelivered:
            living.safetyLock.safetyVerified || living.safetyLock.consigneGiven,
          surgicalProbe: null,
          ticketSummary: living.intervention.technicianSummary,
          investigationPhase: living.readiness,
        }
      : null;

  const scene3D = {
    climate: living.vision3d.climate,
    floorLevel: living.vision3d.floorLevel,
    room: living.vision3d.rooms.join(', ') || null,
    above: living.vision3d.above,
    below: living.vision3d.below,
    element: living.vision3d.element,
    symptomAnchor: living.vision3d.symptomAnchor,
  };

  const agentLabels: Record<string, string> = {
    enqueteur: 'Enquêteur (8B AFPOL)',
    archiviste: 'Archiviste (8B juriste)',
  };

  const savoirSources: LiaLabSavoirSourceRow[] = (living.savoirConsulted ?? []).map(
    (c) => ({
      agent: c.agent,
      agentLabel: agentLabels[c.agent] ?? c.agent,
      corpus: c.corpus,
      ref: c.ref,
      title: c.title,
      url: c.url,
      label: c.label,
      relevance: c.relevance,
      hypothesisLabel: c.hypothesisLabel,
    }),
  );

  const consciousnessConsole: LiaLabFactRow[] = [
    {
      label: 'Profil vulnérable',
      value: living.tenantProfile?.isVulnerable
        ? `OUI — ${living.tenantProfile.reason}`
        : 'Non',
    },
    {
      label: 'Override protection sociale',
      value: living.consciousness?.socialProtectionOverride ? 'ACTIF' : '—',
    },
    {
      label: 'Doute constructif (interne)',
      value: living.consciousness?.constructiveDoubt
        ? living.consciousness.competingModels.join(' · ') || 'oui'
        : '—',
    },
    {
      label: 'Note délibération interne',
      value: living.consciousness?.internalNote ?? '—',
    },
    {
      label: 'Handoff expert (fail-safe)',
      value: living.consciousness?.expertHandoffRequired
        ? `OUI — ${living.consciousness.expertHandoffReason ?? 'impasse'}`
        : 'Non',
    },
  ];

  const livingStateConsole: LiaLabFactRow[] = [
    { label: 'Moteur', value: `LIVING_BUILDING_STATE v${living.version} — Intelligence Symétrique` },
    { label: 'Readiness', value: living.readiness },
    {
      label: 'Barrière humaine',
      value: `${living.humanBarrier.displayName} · ${living.humanBarrier.ageBand} · ${living.humanBarrier.preferredLanguage}`,
    },
    { label: 'Safety verified', value: living.safetyLock.safetyVerified ? 'oui' : 'non' },
    { label: 'Zone sévérité', value: living.safetyLock.severityZone },
    {
      label: 'Tri flux (Archiviste)',
      value: tripleFluxToDisplayLabel(living.legalVerdict.chargeHorizon),
    },
    {
      label: 'Conseil charge Marie',
      value: living.legalVerdict.tenantChargeExplanation ?? '—',
    },
    { label: 'Métier', value: living.intervention.tradeNeeded ?? '—' },
    {
      label: 'Pièces technicien',
      value: living.intervention.partsToBring.join(' · ') || '—',
    },
    {
      label: 'Verdict légal',
      value:
        living.legalVerdict.summary ??
        (living.legalVerdict.articles.map((a) => a.label).join(' · ') || '—'),
    },
    { label: 'Tour délibération', value: String(living.deliberationRound) },
    {
      label: 'Dossier scellé',
      value: living.dossierIntegrity?.sealed
        ? `OUI — ${living.dossierIntegrity.primaryTrade ?? 'métier'} · ${living.dossierIntegrity.sealedAt ?? ''}`
        : 'Non (intake ouvert)',
    },
  ];

  const defaultAgents: LivingTeamAgentCard[] = [
    {
      role: ENQUETEUR_ROLE.id,
      label: ENQUETEUR_ROLE.label,
      mission: ENQUETEUR_ROLE.mission,
      lastInsight: '—',
    },
    {
      role: ARCHIVISTE_ROLE.id,
      label: ARCHIVISTE_ROLE.label,
      mission: ARCHIVISTE_ROLE.mission,
      lastInsight: '—',
    },
    {
      role: MAJORDOME_ROLE.id,
      label: MAJORDOME_ROLE.label,
      mission: MAJORDOME_ROLE.mission,
      lastInsight: '—',
    },
  ];
  const teamAgents =
    living.teamSymbiosis?.agents?.length > 0
      ? living.teamSymbiosis.agents
      : defaultAgents;

  const sym = living.symmetricDeliberation;
  const guardian = living.guardianReview;
  const guardianConsole: LiaLabFactRow[] = guardian
    ? [
        { label: 'Verdict', value: guardian.verdict },
        {
          label: 'Missions déclenchées',
          value: guardian.missionsTriggered.join(' · ') || '—',
        },
        {
          label: 'Parole originale',
          value: guardian.originalParole.slice(0, 120) + (guardian.originalParole.length > 120 ? '…' : ''),
        },
        {
          label: 'Parole finale',
          value: guardian.finalParole.slice(0, 120) + (guardian.finalParole.length > 120 ? '…' : ''),
        },
        {
          label: 'Re-délibération',
          value: guardian.redeliberationBrief ?? '—',
        },
        {
          label: 'Doctrine en attente',
          value: String(guardian.pendingDoctrineLessons?.length ?? living.doctrinePending?.length ?? 0),
        },
      ]
    : [{ label: 'Verdict', value: '— en attente premier tour Gardien —' }];

  const guardianMurmures = guardian?.murmures ?? [];

  const symmetricConsole: LiaLabFactRow[] = [
    { label: 'Niveau', value: sym ? `Symétrique ${sym.level}` : '—' },
    { label: 'Visage Lia', value: sym?.interlocutorFace ?? 'locataire' },
    {
      label: 'Contradiction symétrique',
      value: sym?.contradictionActive
        ? sym.contradictionNote ?? 'active'
        : 'Non',
    },
    { label: 'Métier (instruments)', value: sym?.instrumentsBoard.tradeNeeded ?? '—' },
    { label: 'Charge (instruments)', value: sym?.instrumentsBoard.chargeHorizon ?? '—' },
    { label: 'Doctrine', value: sym?.doctrineVersion ?? '—' },
  ];

  return {
    mentalModels: living.vision3d.mentalModels,
    activeFlows: living.vision3d.activeFlows,
    activeFlowLabels: living.vision3d.activeFlows,
    detectedLot: 'LIVING_INTELLIGENCE',
    urgencyMode:
      living.safetyLock.severityZone === 'ZENITH_DANGER'
        ? 'URGENCE_INCENDIE_ELECTRIQUE'
        : null,
    safetyOverride,
    language: living.language,
    dialogueLanguageLabel: labelDialogueLanguageFr(living.language),
    consoleLanguage: 'fr',
    jarvisFacts: params.state.jarvisFacts ?? {},
    jarvisFactsConsole: livingStateConsole,
    tenantLanguage: living.language,
    tenantLanguageLabel: labelDialogueLanguageFr(living.language),
    visualizationNote:
      living.intervention.technicianSummary ?? living.vision3d.symptomAnchor,
    kbPanneId: null,
    kbPanneLabel: null,
    kbCausesActive: living.vision3d.hypotheses.filter((h) => h.active).map((h) => h.label),
    kbCausesEliminated: living.vision3d.hypotheses
      .filter((h) => !h.active)
      .map((h) => h.label),
    afpolRefs: [
      'LIVING_BUILDING_STATE v6 — Intelligence Symétrique',
      'Majordome pilote 70B · Enquêteur 8B · Archiviste 8B — Instruments de Bord',
      ...(savoirSources.length
        ? [`Savoir consulté : ${savoirSources.length} source(s)`]
        : []),
    ],
    intakePhase: params.state.phase,
    intakePhaseLabel: PHASE_LABELS_FR[params.state.phase] ?? params.state.phase,
    handoffRecommended: living.readiness === 'READY_FOR_TECHNICIAN',
    simulationDomain: null,
    simulationDomainLabel: 'Intelligence Symétrique — Niveau 6',
    scene3D,
    scene3DRows: buildScene3DRows(scene3D),
    physicalHypotheses: living.vision3d.hypotheses
      .filter((h) => h.active)
      .map((h) => h.visualization),
    councilEchoes: living.deliberationEchoes.map((e) => ({
      agent:
        e.agent === 'majordome'
          ? 'Majordome (70B)'
          : e.agent === 'enqueteur'
            ? 'Enquêteur (8B AFPOL)'
            : 'Archiviste (8B juriste)',
      heard: e.model,
      insight: e.insight,
    })),
    housingPerspective: params.state.jarvisFacts?.housing_visual ?? null,
    livingBuildingState: living,
    livingStateConsole,
    savoirSources,
    consciousnessConsole,
    teamSymbiosis: {
      charter: living.teamSymbiosis?.charter ?? '',
      agents: teamAgents,
      dossierSealed: living.dossierIntegrity?.sealed === true,
      primaryTrade: living.dossierIntegrity?.primaryTrade ?? null,
    },
    symmetricConsole,
    instrumentsPilotBrief: sym?.instrumentsBoard.pilotBrief ?? null,
    guardianConsole,
    guardianMurmures,
  };
}

function emptyLivingFallback(params: {
  state: LiaIntakeState;
  title: string;
  description: string;
}): LivingBuildingState {
  const lang = (params.state.preferredLanguage === 'gcf' ? 'gcf' : 'fr') as CompanionLanguage;
  return {
    schema: 'LIVING_BUILDING_STATE',
    version: 6,
    updatedAt: new Date().toISOString(),
    language: lang,
    readiness: 'OPENING',
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
      displayName: 'Marie',
      ageBand: 'senior',
      livesAlone: true,
      preferredLanguage: lang,
      creolePreferred: lang === 'gcf',
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
    dossierIntegrity: {
      sealed: false,
      sealedAt: null,
      primaryTrade: null,
      signalementScope: null,
      oneTicketOneTrade: true,
    },
    teamSymbiosis: {
      charter: '',
      agents: [],
      updatedAt: new Date().toISOString(),
    },
    symmetricDeliberation: {
      level: 6,
      interlocutorFace: 'locataire',
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
        pilotBrief: '—',
      },
      expertReports: { enqueteur: null, archiviste: null, majordomeFacts: null },
      contradictionActive: false,
      contradictionNote: null,
      doctrineVersion: 'symmetric-6',
    },
    lastTenantMessage: null,
    reasoningSource: 'living_intelligence',
    guardianReview: null,
    doctrinePending: [],
  };
}
