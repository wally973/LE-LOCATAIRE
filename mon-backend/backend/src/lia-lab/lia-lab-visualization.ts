import {
  parseSimulationFromState,
  runJarvisSimulation,
} from '../agents/orchestrateur/intake/lia-jarvis-simulation.engine';
import type { LiaIntakeState } from '../agents/orchestrateur/intake/lia-intake.service';

export interface LiaLabVisualization {
  mentalModels: string[];
  activeFlows: string[];
  detectedLot: string;
  urgencyMode: string | null;
  language: string;
  jarvisFacts: Record<string, string>;
  visualizationNote: string | null;
  kbPanneId: string | null;
  kbPanneLabel: string | null;
  kbCausesActive: string[];
  kbCausesEliminated: string[];
  afpolRefs: string[];
  intakePhase: string;
  handoffRecommended: boolean;
  /** Simulation Jarvis (scène 3D + hypothèses) */
  simulationDomain: string | null;
  scene3D: Record<string, string | null>;
  physicalHypotheses: string[];
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

  return {
    mentalModels: sim.mentalModels,
    activeFlows: sim.activeFlows,
    detectedLot: domainToLot[sim.domain] ?? params.state.category ?? 'GENERIC',
    urgencyMode,
    language: sim.language,
    jarvisFacts: params.state.jarvisFacts ?? {},
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
      ...(params.state.organizer?.panneId
        ? [`Référentiel validation : ${params.state.organizer.panneId}`]
        : []),
    ],
    intakePhase: params.state.phase,
    handoffRecommended: params.state.answers.jarvis_handoff === 'oui',
    simulationDomain: sim.domain,
    scene3D: {
      climate: sim.scene.climate,
      floorLevel: sim.scene.floorLevel,
      room: sim.scene.room,
      above: sim.scene.above,
      below: sim.scene.below,
      element: sim.scene.element,
      symptomAnchor: sim.scene.symptomAnchor,
    },
    physicalHypotheses: activeHypos.map((h) => h.visualization),
  };
}
