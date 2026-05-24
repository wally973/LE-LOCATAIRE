/**
 * Protocole urgence — électricité dangereuse, ascenseur (personnes).
 */
import {
  detectMasterDomain,
  detectMasterUrgentDanger,
} from '../diagnostiqueur/rules/master-diagnostic-engine';
import type { AiPipelineDecision } from '../../ai-routing/ai-pipeline.port';

export const URGENT_CRITIQUE_SEVERITY = 'URGENT_CRITIQUE' as const;

export type UrgentSeverity =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | typeof URGENT_CRITIQUE_SEVERITY;

export function applyUrgentCriticalOverlay(
  decision: AiPipelineDecision,
  contextText: string,
): AiPipelineDecision {
  const domain = detectMasterDomain(contextText);
  const urgent = detectMasterUrgentDanger(contextText, domain);
  if (!urgent.urgent) {
    return decision;
  }

  const category =
    domain?.category ??
    (urgent.domainId === 'ELECTRICITY' ? 'ELECTRICITY' : decision.category);

  return {
    ...decision,
    responsibility: 'BAILLEUR',
    category,
    severity: URGENT_CRITIQUE_SEVERITY,
    confidence: Math.max(decision.confidence, 0.92),
    needsMorePhoto: false,
    socialFlag: false,
    suggestedArtisanType: 'ELECTRICIAN',
    message: `${urgent.message}\n\n${decision.message}`.trim(),
    pipelineSteps: [
      ...decision.pipelineSteps,
      {
        name: 'urgent_safety_protocol',
        decision: URGENT_CRITIQUE_SEVERITY,
        extra: { domainId: urgent.domainId },
      },
    ],
  };
}

export function isUrgentCriticalSeverity(severity: string): boolean {
  return severity === URGENT_CRITIQUE_SEVERITY;
}
