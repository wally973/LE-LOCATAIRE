/**
 * Pilotage réactif LIA — objectifs (Goals), pas d’étapes linéaires fixes.
 */

import type { TicketResponsibility, TicketStatus } from '@prisma/client';
import type { QualificationFlags } from '../../../feature-flags/qualification-flags.types';
import type { LiaIntakeState } from '../intake/lia-intake.service';
import type { CompanionUiState } from './lia-companion.types';
import type { ExpertRectificationStored } from '../../diagnostiqueur/briefing/lia-expert-rectification.types';
import type { DiagnosticState } from '../../shared/lia-diagnostic-state.types';
import type { DiagnosticSensors } from '../../shared/lia-diagnostic-state.types';
import type { SavoirVoirPhase } from '../../shared/savoir-voir.types';

/** Objectifs métier : l’agent choisit le prochain selon le SharedState. */
export type LiaGoal =
  | 'COMPREHEND_SITUATION'
  | 'COLLECT_MISSING_FACTS'
  | 'OBTAIN_VISUAL_EVIDENCE'
  | 'RUN_DIAGNOSTIC'
  | 'ISOLATE_WRONG_TOPIC'
  | 'RESOLVE_ARTISAN_INTENT'
  | 'ACKNOWLEDGE_TENANT'
  | 'COMPLETE_DOSSIER';

export type AgentTrigger =
  | 'TICKET_OPENED'
  | 'TENANT_MESSAGE'
  | 'PHOTO_UPLOADED'
  | 'DIAGNOSTIC_COMPLETED'
  | 'INTERNAL';

export interface AgentMemory {
  completedGoals: LiaGoal[];
  lastGoal: LiaGoal | null;
  lastTrigger: AgentTrigger | null;
  updatedAt: string;
}

/** État partagé — source de vérité pour la décision agent. */
export interface LiaSharedState {
  ticketId: number;
  tenantUserId: number;
  title: string;
  description: string;
  tenantFirstName: string;
  status: TicketStatus;
  responsibility: TicketResponsibility;
  landlordProfileId: number | null;
  flags: QualificationFlags;
  intake: LiaIntakeState | null;
  companion: CompanionUiState | null;
  followUpClosed: boolean;
  artisanDeclined: boolean;
  hasArtisanRequest: boolean;
  agent: AgentMemory;
  /** Rectification expert — source de vérité si présente. */
  expertRectification: ExpertRectificationStored | null;
  diagnosticAuthority: 'AI_PROPOSED' | 'EXPERT_VALIDATED';
  /** Logique différentielle — signes cliniques + hypothèses (AFPOLS/AQC). */
  diagnostic: DiagnosticState | null;
  /** Capteurs structurés (REF_EAU_SAVONNEUSE) — toujours défini. */
  sensors: DiagnosticSensors;
  /** Phase Savoir-Voir courante. */
  savoirVoirPhase: SavoirVoirPhase;
  /** Contexte locataire sans brief interne (règles déterministes). */
  caseContext: string;
  /** Dernier message locataire (déclencheur réactif). */
  lastTenantMessage?: string;
  /** Lot locataire (inscription) — alimente le conseil IA collectif / plein pied. */
  residenceUnitNumber?: string | null;
}

export interface GoalExecutionResult {
  state: LiaSharedState;
  /** Enchaîner une autre décision dans la même passe (réactif). */
  continueLoop: boolean;
}

export function parseAgentMemory(aiLastDecision: unknown): AgentMemory {
  const base: AgentMemory = {
    completedGoals: [],
    lastGoal: null,
    lastTrigger: null,
    updatedAt: new Date().toISOString(),
  };
  if (!aiLastDecision || typeof aiLastDecision !== 'object') return base;
  const raw = (aiLastDecision as { agent?: Partial<AgentMemory> }).agent;
  if (!raw) return base;
  return {
    completedGoals: Array.isArray(raw.completedGoals)
      ? (raw.completedGoals as LiaGoal[])
      : [],
    lastGoal: (raw.lastGoal as LiaGoal | null) ?? null,
    lastTrigger: (raw.lastTrigger as AgentTrigger | null) ?? null,
    updatedAt: raw.updatedAt ?? base.updatedAt,
  };
}

export function goalCompleted(state: LiaSharedState, goal: LiaGoal): boolean {
  return state.agent.completedGoals.includes(goal);
}

export function markGoalDone(state: LiaSharedState, goal: LiaGoal): AgentMemory {
  const completed = state.agent.completedGoals.includes(goal)
    ? state.agent.completedGoals
    : [...state.agent.completedGoals, goal];
  return {
    completedGoals: completed,
    lastGoal: goal,
    lastTrigger: state.agent.lastTrigger,
    updatedAt: new Date().toISOString(),
  };
}
