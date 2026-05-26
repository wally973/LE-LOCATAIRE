import type { LiaMessageUiStatus } from '../orchestrateur/conversation/lia-message-ui-status';
import type { LiaIntakeState } from '../orchestrateur/intake/lia-intake.service';

/** Réponse structurée du modèle (compréhension uniquement — pas le verdict juridique). */
export interface LlmFirstModelOutput {
  language?: 'fr' | 'gcf';
  acknowledgment: string;
  nextQuestion?: string | null;
  intakeComplete?: boolean;
  acquiredFacts?: Record<string, string>;
  /** Si true, ne pas utiliser INTAKE_QUESTIONS / script organisateur. */
  skipScriptQuestions?: boolean;
  uiStatusKind?: 'ANALYZING' | 'LANDLORD_HANDOFF' | null;
}

export interface LlmFirstComprehensionResult {
  state: LiaIntakeState;
  acknowledgment: string;
  nextQuestion: string | null;
  uiStatus?: LiaMessageUiStatus;
  fromLlm: boolean;
}
