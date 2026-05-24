/**
 * Phases Savoir-Voir — observation avant conclusion (MANIFESTE / REF_EAU_SAVONNEUSE).
 */
export type SavoirVoirPhase =
  | 'OBSERVATION'
  | 'ELIMINATION'
  | 'HYPOTHESES'
  | 'CONCLUSION';

export interface SavoirVoirContextMeta {
  phase: SavoirVoirPhase;
  /** Hypothèse dominante après élimination (id pathology-index). */
  leadingHypothesisId?: string | null;
}
