/** Données critiques extraites du SharedState pour un technicien. */
export interface ProBriefingCritical {
  /** Équipement / zone concernée (heuristique titre + intake). */
  model: string | null;
  symptoms: string[];
  category: string;
  categoryLabel: string;
  severity: string | null;
  confidence: number | null;
  responsibility: string | null;
  roomHint: string | null;
  safetyLevel: string | null;
  artisanType: string | null;
  photoCount: number;
  intakePhase: string | null;
}

/** Résultats recherche interne + contexte diagnostic. */
export interface ProBriefingResearch {
  tradeFiche: string;
  searchTrigger: string | null;
  intakeSummary: string;
  similarCases: string[];
  juristRationale: string | null;
  pipelineTrace: string[];
}

/** Briefing technique complet. */
export interface ProBriefing {
  ticketId: number;
  caseNumber: string | null;
  title: string;
  description: string;
  status: string;
  housingAddress: string | null;
  generatedAt: string;
  /** Synthèse rédigée (LLM si disponible, sinon règles). */
  narrativeSummary: string;
  critical: ProBriefingCritical;
  research: ProBriefingResearch;
  diagnosticMessage: string | null;
  diagnosticAuthority: 'AI_PROPOSED' | 'EXPERT_VALIDATED';
  expertCorrection: {
    expertName: string;
    correctedDiagnosis: string;
    reason: string;
    modelHint: string | null;
    correctedAt: string;
    responsibility: string | null;
    specialHandling: string[];
    vulnerableDetail: string | null;
    takeCharge: boolean;
  } | null;
  fromLlm: boolean;
}

export interface ProBriefingAskResult {
  question: string;
  answer: string;
  fromLlm: boolean;
  /** Contexte utilisé (extrait). */
  contextHint: string;
}
