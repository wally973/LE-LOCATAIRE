/** Contrat des scénarios or (data/golden-scenarios.json). */

export interface GoldenTurnExpect {
  mustContain?: string[];
  mustNotContain?: string[];
  mustMentionAny?: string[];
  maxHostQuestions?: number;
}

export interface GoldenTurn {
  tenant: string;
  expect?: GoldenTurnExpect;
}

export interface GoldenScenarioExpectations {
  language?: 'fr' | 'gcf';
  mustContain?: string[];
  mustNotContain?: string[];
  mustMentionAny?: string[];
  maxHostQuestions?: number;
  intakeCompleteOnOpening?: boolean;
  allowsPhotoRequest?: boolean;
}

export interface GoldenScenario {
  id: string;
  label: string;
  family: string;
  tenantFirstName: string;
  title: string;
  description: string;
  turns: GoldenTurn[];
  expectations: GoldenScenarioExpectations;
}

export interface GoldenScenariosFile {
  version: number;
  description?: string;
  scenarios: GoldenScenario[];
}

/** Sortie d’un pas de dialogue (ouverture ou tour locataire). */
export interface GoldenDialogueStep {
  acknowledgment: string | null;
  nextQuestion: string | null;
  combinedHostText: string;
  intakePhase: string;
  preferredLanguage?: string;
}

export interface GoldenEvaluationIssue {
  scenarioId: string;
  step: string;
  rule: string;
  detail: string;
}

export interface GoldenScenarioResult {
  id: string;
  label: string;
  passed: boolean;
  skippedLive?: boolean;
  issues: GoldenEvaluationIssue[];
  steps: GoldenDialogueStep[];
}
