export {
  LEGAL_AI_FINAL_CATCHPHRASE_FR,
  LEGAL_AI_DISCLAIMER_FR,
  GUARDRAIL_REFUSAL_MESSAGE_FR,
} from './legalDisclaimer';
export {
  AI_GUARD_RAIL_REFUSAL_EVENT,
  AI_PIPELINE_OUTPUT_EVENT,
  dispatchGuardrailRefusal,
  dispatchPipelineOutput,
  type AIGuardrailRefusalPayload,
  type AIPipelineOutputPayload,
} from './aiCoachEvents';
export { evaluateGuardrail } from './evaluateGuardrail';
export { useAIGuardrail } from './useAIGuardrail';
export { useLegalAI } from './useLegalAI';
export {
  useOrchestratorAI,
  type CoachStep,
} from './useOrchestratorAI';
export { useCommunicationAI } from './useCommunicationAI';
export { useDiagnosticAI } from './useDiagnosticAI';
export {
  useMultilingualAI,
  type SupportedLocale,
} from './useMultilingualAI';
export { useCleaningAI } from './useCleaningAI';
export {
  executeAIPipelineSync,
  type DiagnosticHint,
  type LegalAnalysisInput,
  type PipelineServices,
} from './executeAIPipeline';
export { refusalMessage } from './refusalMessages.i18n';
export type {
  AIGuardrailResult,
  AIPipelineResult,
  PipelineInputOptions,
} from './pipelineTypes';
