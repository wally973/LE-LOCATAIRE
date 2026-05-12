import type { AvatarExpression } from '@/types/locataire';

export const AI_GUARD_RAIL_REFUSAL_EVENT = 'le-locataire:ai-guardrail-refusal';
export const AI_PIPELINE_OUTPUT_EVENT = 'le-locataire:ai-pipeline-output';

export interface AIGuardrailRefusalPayload {
  safeMessage: string;
  reason?: string;
}

export interface AIPipelineOutputPayload {
  message: string;
  expression: AvatarExpression;
  highlightSelector?: string | null;
}

export function dispatchGuardrailRefusal(detail: AIGuardrailRefusalPayload): void {
  window.dispatchEvent(
    new CustomEvent<AIGuardrailRefusalPayload>(AI_GUARD_RAIL_REFUSAL_EVENT, {
      detail,
    }),
  );
}

export function dispatchPipelineOutput(detail: AIPipelineOutputPayload): void {
  window.dispatchEvent(
    new CustomEvent<AIPipelineOutputPayload>(AI_PIPELINE_OUTPUT_EVENT, {
      detail,
    }),
  );
}
