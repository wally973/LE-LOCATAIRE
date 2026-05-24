/**
 * Types — knowledge/master-diagnostic-rules.json (Savoir-Voir multi-domaines).
 */

export interface MasterSensorDef {
  id: string;
  label: string;
  required: boolean;
  intakeQuestionId?: string;
}

export interface MasterHypothesisDef {
  id: string;
  label: string;
  defaultProbability: number;
  responsibilityHint: 'LOCATAIRE' | 'BAILLEUR' | 'NUANCE';
}

export interface MasterEliminationRule {
  id: string;
  whenTextMatches: string;
  eliminate: string[];
  boost?: Record<string, number>;
  eliminationReason: string;
}

export interface MasterDomainRules {
  id: string;
  label: string;
  category: string;
  keywords: string[];
  criticalSensors: MasterSensorDef[];
  hypotheses: MasterHypothesisDef[];
  eliminationRules: MasterEliminationRule[];
  urgentDangerPatterns: string[];
  urgentSafetyMessage?: string;
}

export interface MasterDiagnosticCatalog {
  version: number;
  updatedAt: string;
  method: string;
  description?: string;
  domains: MasterDomainRules[];
}

export interface MasterHypothesisResult {
  id: string;
  label: string;
  probability: number;
  responsibilityHint: 'LOCATAIRE' | 'BAILLEUR' | 'NUANCE';
  eliminated?: boolean;
  eliminationReason?: string;
}

export interface MasterDifferentialResult {
  domainId: string;
  domainLabel: string;
  category: string;
  leadingHypothesisId: string;
  hypotheses: MasterHypothesisResult[];
  observation: string;
  responsibilityHint: 'LOCATAIRE' | 'BAILLEUR' | 'NUANCE';
  missingCriticalSensors: string[];
}
