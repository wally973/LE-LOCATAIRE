import { labelDialogueLanguageFr } from '../agents/shared/lia-dialogue-languages';
import type { CompanionLanguage } from '../agents/orchestrateur/conversation/lia-companion.types';
import {
  parseSimulationFromState,
  runJarvisSimulation,
  type JarvisFlowKind,
  type JarvisSimulationDomain,
} from '../agents/orchestrateur/intake/lia-jarvis-simulation.engine';
import { parseCouncilRound, councilAgentLabelFr } from '../agents/orchestrateur/intake/lia-jarvis-council.engine';
import type { LiaIntakeState } from '../agents/orchestrateur/intake/lia-intake.service';

export interface LiaLabSceneRow {
  label: string;
  value: string;
}

export interface LiaLabFactRow {
  label: string;
  value: string;
}

export interface LiaLabVisualization {
  mentalModels: string[];
  activeFlows: string[];
  /** Libellés français pour la console opérateur */
  activeFlowLabels: string[];
  detectedLot: string;
  urgencyMode: string | null;
  /** Langue choisie pour le dialogue locataire */
  language: CompanionLanguage;
  /** Libellé français — langue du dialogue Jarvis côté locataire */
  dialogueLanguageLabel: string;
  /** Console expert : toujours français */
  consoleLanguage: 'fr';
  jarvisFacts: Record<string, string>;
  /** Faits filtrés et libellés en français pour la console */
  jarvisFactsConsole: LiaLabFactRow[];
  visualizationNote: string | null;
  kbPanneId: string | null;
  kbPanneLabel: string | null;
  kbCausesActive: string[];
  kbCausesEliminated: string[];
  afpolRefs: string[];
  intakePhase: string;
  /** Phase intake en français pour la console */
  intakePhaseLabel: string;
  handoffRecommended: boolean;
  tenantLanguage?: string;
  tenantLanguageLabel?: string;
  /** Simulation Jarvis (scène 3D + hypothèses) */
  simulationDomain: string | null;
  simulationDomainLabel: string | null;
  scene3D: Record<string, string | null>;
  scene3DRows: LiaLabSceneRow[];
  physicalHypotheses: string[];
  /** Murmures du conseil IA (tous écoutent — Jarvis parle seul) */
  councilEchoes: { agent: string; heard: string; insight: string }[];
  housingPerspective: string | null;
}

const FLOW_LABELS_FR: Record<JarvisFlowKind, string> = {
  eau: 'Eau',
  air: 'Air',
  chaleur: 'Chaleur',
  mécanique: 'Mécanique',
  étanchéité: 'Étanchéité',
  signal: 'Signal',
};

const SCENE_LABELS_FR: Record<string, string> = {
  climate: 'Climat',
  floorLevel: 'Niveau',
  room: 'Pièce',
  above: 'Au-dessus',
  below: 'En dessous',
  element: 'Élément',
  symptomAnchor: 'Ancrage symptôme',
};

const SCENE_VALUE_LABELS_FR: Record<string, string> = {
  tropical_humid: 'Tropical humide (Guyane)',
  dry_season: 'Saison sèche',
};

const DOMAIN_LABELS_FR: Record<JarvisSimulationDomain, string> = {
  plumbing_sink: 'Plomberie — point d’eau',
  carpentry_door: 'Menuiserie — porte',
  roof_envelope: 'Enveloppe — toiture / façade',
  electricity: 'Électricité',
  generic: 'Générique',
};

const JARVIS_FACT_LABELS_FR: Record<string, string> = {
  visualization: 'Visualisation',
  liaison_langue: 'Langue liaison',
  locataire_langue: 'Langue locataire',
  equipement: 'Équipement',
  localisation: 'Localisation',
  handoff_reason: 'Motif handoff',
  element: 'Élément',
  housing_visual: 'Perspective logement',
  housing_kind: 'Type logement (inscription)',
  council_last: 'Dernier tour conseil',
};

const PHASE_LABELS_FR: Record<string, string> = {
  INTAKE: 'Collecte (intake)',
  DONE: 'Terminé',
  ORGANIZER: 'Organisation',
};


function labelSceneValue(key: string, value: string): string {
  if (key === 'climate') {
    return SCENE_VALUE_LABELS_FR[value] ?? value;
  }
  return value;
}

function buildScene3DRows(
  scene3D: Record<string, string | null>,
): LiaLabSceneRow[] {
  return Object.entries(scene3D)
    .filter(([, value]) => value)
    .map(([key, value]) => ({
      label: SCENE_LABELS_FR[key] ?? key,
      value: labelSceneValue(key, value!),
    }));
}

function buildJarvisFactsConsole(
  facts: Record<string, string> | undefined,
): LiaLabFactRow[] {
  if (!facts) return [];
  return Object.entries(facts)
    .filter(([key]) => key !== 'jarvis_simulation' && key !== 'council_last')
    .map(([key, value]) => ({
      label: JARVIS_FACT_LABELS_FR[key] ?? key.replace(/_/g, ' '),
      value:
        key === 'locataire_langue' || key === 'liaison_langue'
          ? labelDialogueLanguageFr(
              ['fr', 'gcf', 'en', 'pt', 'es', 'hat'].includes(value)
                ? (value as CompanionLanguage)
                : 'fr',
            )
          : value,
    }));
}

function norm(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

export function buildLabVisualization(params: {
  state: LiaIntakeState;
  title: string;
  description: string;
  lastMessage?: string;
}): LiaLabVisualization {
  const full = norm(`${params.title} ${params.description} ${params.lastMessage ?? ''}`);

  const simStored = parseSimulationFromState(params.state);
  const sim =
    simStored ??
    runJarvisSimulation({
      title: params.title,
      description: params.description,
      message: params.lastMessage ?? '',
      preferredLanguage: params.state.preferredLanguage,
    });

  let urgencyMode: string | null = null;
  if (
    (/bonjou|dlo|bokit|vit|anpil|koule/.test(full) || /urgent|press/.test(full)) &&
    /lavabo|evier|évier|fuit|eau|dlo/.test(full)
  ) {
    urgencyMode = 'URGENCE_PLOMBERIE';
  }

  const activeHypos = sim.hypotheses.filter((h) => h.active);

  const domainToLot: Record<string, string> = {
    plumbing_sink: 'PLUMBING',
    carpentry_door: 'CARPENTRY',
    roof_envelope: 'ROOF',
    electricity: 'ELECTRICITY',
    generic: params.state.category ?? 'GENERIC',
  };

  const dialogueLanguage = sim.language;
  const tenantLangRaw = dialogueLanguage;

  const scene3D = {
    climate: sim.scene.climate,
    floorLevel: sim.scene.floorLevel,
    room: sim.scene.room,
    above: sim.scene.above,
    below: sim.scene.below,
    element: sim.scene.element,
    symptomAnchor: sim.scene.symptomAnchor,
  };

  return {
    mentalModels: sim.mentalModels,
    activeFlows: sim.activeFlows,
    activeFlowLabels: sim.activeFlows.map((f) => FLOW_LABELS_FR[f] ?? f),
    detectedLot: domainToLot[sim.domain] ?? params.state.category ?? 'GENERIC',
    urgencyMode,
    language: dialogueLanguage,
    dialogueLanguageLabel: labelDialogueLanguageFr(dialogueLanguage),
    consoleLanguage: 'fr',
    jarvisFacts: params.state.jarvisFacts ?? {},
    jarvisFactsConsole: buildJarvisFactsConsole(params.state.jarvisFacts),
    tenantLanguage: tenantLangRaw,
    tenantLanguageLabel: labelDialogueLanguageFr(tenantLangRaw),
    visualizationNote: sim.visualizationSummary,
    kbPanneId: params.state.organizer?.panneId ?? null,
    kbPanneLabel: null,
    kbCausesActive: activeHypos.map((h) => h.label),
    kbCausesEliminated: sim.hypotheses
      .filter((h) => !h.active)
      .map((h) => h.label),
    afpolRefs: [
      'MISSION_JARVIS — simulation physique (pas script JSON)',
      'VISUAL_LOGIC.md',
      'Conseil IA — tous écoutent, Jarvis synthétise',
      ...(params.state.organizer?.panneId
        ? [`Référentiel validation : ${params.state.organizer.panneId}`]
        : []),
    ],
    intakePhase: params.state.phase,
    intakePhaseLabel: PHASE_LABELS_FR[params.state.phase] ?? params.state.phase,
    handoffRecommended: params.state.answers.jarvis_handoff === 'oui',
    simulationDomain: sim.domain,
    simulationDomainLabel: DOMAIN_LABELS_FR[sim.domain] ?? sim.domain,
    scene3D,
    scene3DRows: buildScene3DRows(scene3D),
    physicalHypotheses: activeHypos.map((h) => h.visualization),
    councilEchoes: (parseCouncilRound(params.state.jarvisFacts?.council_last)?.echoes ?? []).map(
      (e) => ({
        agent: councilAgentLabelFr(e.agent),
        heard: e.heard,
        insight: e.insight,
      }),
    ),
    housingPerspective: params.state.jarvisFacts?.housing_visual ?? null,
  };
}
