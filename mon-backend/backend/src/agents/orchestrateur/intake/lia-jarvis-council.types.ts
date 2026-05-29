import type { HousingPerspective } from './lia-housing-perspective';
import type { JarvisSimulationState } from './lia-jarvis-simulation.engine';
import type { LiaIntakeState } from './lia-intake.service';

/** Agents qui écoutent le même message — chacun réagit si l’écho le concerne. */
export type CouncilAgentId =
  | 'savoir'
  | 'visual'
  | 'chercheur'
  | 'pathologiste'
  | 'juriste';

/** Murmure interne — Jarvis seul parle au locataire. */
export interface CouncilEcho {
  agent: CouncilAgentId;
  /** Ce que l’agent a entendu dans le message */
  heard: string;
  /** Insight pour la console expert / SharedState */
  insight: string;
  /** Question proposée à Jarvis (priorité par confidence) */
  suggestedQuestion?: string;
  confidence: number;
}

export interface CouncilRound {
  at: string;
  message: string;
  housing: HousingPerspective;
  echoes: CouncilEcho[];
}

export interface CouncilListenParams {
  title: string;
  description: string;
  message: string;
  state: LiaIntakeState;
  simulation: JarvisSimulationState;
  housing: HousingPerspective;
  chainQuestion: string | null;
}
