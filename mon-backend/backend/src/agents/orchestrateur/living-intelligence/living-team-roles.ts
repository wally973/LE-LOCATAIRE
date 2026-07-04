/**
 * Stubs rétrocompatibles — architecture Grock mono-agent.
 */
import type { LivingTeamSymbiosis } from './living-building-state.types';

export const LIVING_TEAM_CHARTER_FR =
  'Grock — technicien senior mono-agent (Groq Llama 3.3 70B).';

export const ENQUETEUR_ROLE = '';
export const ARCHIVISTE_ROLE = '';
export const MAJORDOME_ROLE = '';

export function buildEnqueteurSystemPrompt(): string {
  return '';
}

export function buildArchivisteSystemPrompt(): string {
  return '';
}

export function buildMajordomeFactsSystemPrompt(): string {
  return '';
}

export function buildMajordomeOpeningSpeakHint(): string {
  return '';
}

export function buildMajordomeSpeakSystemPrompt(): string {
  return '';
}

export function buildTeamSymbiosisSnapshot(_params?: Record<string, unknown>): LivingTeamSymbiosis {
  return {
    charter: LIVING_TEAM_CHARTER_FR,
    agents: [],
    updatedAt: new Date().toISOString(),
  };
}
