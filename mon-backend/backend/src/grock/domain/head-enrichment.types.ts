import type {
  Head1AnalysisInput,
  Head2VerificationInput,
  Head3DeductionInput,
  Head4DecisionInput,
  Head5ResolutionInput,
} from './head-pack.contract';
import type { PreprocessedSignal } from '../preprocessor/preprocessor.types';

/**
 * Contexte passé du noyau (T1/T2) au pack métier (T3–T5).
 * Le pack ne refait pas la Couche 0 ni T1/T2.
 */
export interface HeadEnrichmentContext {
  signal: PreprocessedSignal;
  head1: Head1AnalysisInput;
  head2: Head2VerificationInput;
  /** Corpus textuel unifié (signalement + perception). */
  corpus: string;
}

/** Sortie pack — Tête 3 · Déduction. */
export type Head3PackOutput = Head3DeductionInput & { promptBlock: string };

/** Sortie pack — Tête 4 · Décision. */
export type Head4PackOutput = Head4DecisionInput & { promptBlock: string };

/** Sortie pack — Tête 5 · Résolution. */
export type Head5PackOutput = Head5ResolutionInput & { promptBlock: string };
