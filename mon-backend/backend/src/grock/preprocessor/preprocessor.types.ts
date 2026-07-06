import type { GrockChatMessage, GrockImageAttachment } from '../grock.service';
import type { GrockInterlocutor } from '../kernel/grock-interlocutor';
import type { SignalQualityMeta } from '../kernel/grock-confidence-scores';

/** Entrée brute d'un tour — avant nettoyage et contextualisation. */
export interface GrockPreprocessorInput {
  tenantFirstName: string;
  title: string;
  description: string;
  tenantMessage: string;
  sessionMessages: GrockChatMessage[];
  interlocutor?: GrockInterlocutor;
  adminContext?: string | null;
  images?: GrockImageAttachment[];
}

/**
 * Signal préparé (Couche 0) — base invariante des 5 têtes.
 * Perception brute sans interprétation ; texte normalisé ; cadrage selon le rôle.
 */
export interface PreprocessedSignal {
  tenantFirstName: string;
  title: string;
  description: string;
  tenantMessage: string;
  sessionMessages: GrockChatMessage[];
  interlocutor: GrockInterlocutor;
  /** Bloc signalement structuré injecté au noyau (faits déclarés, pas de diagnostic). */
  signalementBlock: string;
  /** Perception visuelle brute — pixels décrits sans titre/récit (anti-variance cadrage). */
  visualPerceptionRaw: string | null;
  visionModel: string | null;
  /** Couche 0 — qualité signal entrée (0–10), modulateur de prudence des têtes. */
  signalQuality: number;
  signalQualityFactors: SignalQualityMeta;
  meta: {
    role: GrockInterlocutor;
    textFieldsNormalized: number;
    imageProcessed: boolean;
  };
}
