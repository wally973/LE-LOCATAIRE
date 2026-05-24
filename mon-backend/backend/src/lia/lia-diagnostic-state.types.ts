/**
 * État diagnostic différentiel — signes cliniques et hypothèses (méthode AFPOLS/AQC).
 * Persisté dans ticket.aiLastDecision.diagnostic.
 */

/** Canal du signe clinique (logique différentielle). */
export type ClinicalSignChannel =
  | 'color'
  | 'texture'
  | 'odor'
  | 'pattern'
  | 'location';

export type ClinicalSignSource =
  | 'tenant_text'
  | 'photo_ai'
  | 'intake_answer'
  | 'expert';

/** Un signe observable — odeur, couleur, texture, motif, lieu. */
export interface ClinicalSign {
  channel: ClinicalSignChannel;
  /** Valeur normalisée ou citation courte locataire. */
  value: string;
  source: ClinicalSignSource;
  /** Confiance [0,1] si inféré automatiquement. */
  confidence?: number;
}

export type KnowledgeCorpus = 'AFPOLS' | 'AQC' | 'INTERNAL';

/** Page « ouverte » par le bibliothécaire (Researcher). */
export interface KnowledgeRef {
  corpus: KnowledgeCorpus;
  /** Code cours AFPOLS (C0237) ou ref fiche AQC (B.01). */
  ref: string;
  title: string;
  url?: string;
}

/** Hypothèse différentielle en cours d'évaluation. */
export interface DifferentialHypothesis {
  id: string;
  label: string;
  /** Probabilité relative [0,1] après scoring signes + mots-clés. */
  probability: number;
  category?: string;
  responsibilityHint?: 'BAILLEUR' | 'LOCATAIRE' | 'NUANCE';
  danger?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  sources: KnowledgeRef[];
  eliminated?: boolean;
  eliminationReason?: string;
}

/**
 * État diagnostic partagé — enrichi par Researcher, Pathologiste, intake.
 * Ne remplace pas aiLastDecision.responsibility : prépare et documente le raisonnement.
 */
export interface DiagnosticState {
  clinicalSigns: ClinicalSign[];
  hypotheses: DifferentialHypothesis[];
  leadingHypothesisId: string | null;
  researchRefs: KnowledgeRef[];
  /** Canaux à compléter (ex. odeur non mentionnée, photo floue). */
  missingSignChannels: ClinicalSignChannel[];
  /** Score global de certitude différentielle [0,1]. */
  differentialConfidence: number;
  updatedAt: string;
}

export function emptyDiagnosticState(): DiagnosticState {
  return {
    clinicalSigns: [],
    hypotheses: [],
    leadingHypothesisId: null,
    researchRefs: [],
    missingSignChannels: ['color', 'texture', 'odor', 'pattern', 'location'],
    differentialConfidence: 0,
    updatedAt: new Date().toISOString(),
  };
}

export function parseDiagnosticState(
  aiLastDecision: unknown,
): DiagnosticState | null {
  if (!aiLastDecision || typeof aiLastDecision !== 'object') return null;
  const raw = (aiLastDecision as { diagnostic?: Partial<DiagnosticState> })
    .diagnostic;
  if (!raw || typeof raw !== 'object') return null;
  return {
    clinicalSigns: Array.isArray(raw.clinicalSigns)
      ? (raw.clinicalSigns as ClinicalSign[])
      : [],
    hypotheses: Array.isArray(raw.hypotheses)
      ? (raw.hypotheses as DifferentialHypothesis[])
      : [],
    leadingHypothesisId:
      typeof raw.leadingHypothesisId === 'string'
        ? raw.leadingHypothesisId
        : null,
    researchRefs: Array.isArray(raw.researchRefs)
      ? (raw.researchRefs as KnowledgeRef[])
      : [],
    missingSignChannels: Array.isArray(raw.missingSignChannels)
      ? (raw.missingSignChannels as ClinicalSignChannel[])
      : [],
    differentialConfidence:
      typeof raw.differentialConfidence === 'number'
        ? raw.differentialConfidence
        : 0,
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  };
}

export function mergeDiagnosticIntoAiLastDecision(
  aiLastDecision: unknown,
  diagnostic: DiagnosticState,
): Record<string, unknown> {
  const base =
    aiLastDecision && typeof aiLastDecision === 'object'
      ? { ...(aiLastDecision as Record<string, unknown>) }
      : {};
  return { ...base, diagnostic };
}
