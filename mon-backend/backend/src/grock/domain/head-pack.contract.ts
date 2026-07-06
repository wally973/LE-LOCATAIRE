import type { GrockInterlocutor } from '../kernel/grock-interlocutor';

/**
 * Contrat T3–T5 — Couche 3 (pack métier).
 * Le noyau head-input ne définit pas ces types : il les consomme via GrockHeadInputs.
 * Forme pilote « logement social » ; un autre pack peut étendre ce contrat plus tard.
 */

/** Scores d’hypothèse — Tête 3 (pondération, pas de verdict). */
export interface Head3HypothesisScores {
  infiltration_score: number;
  origine_voisin_score: number;
  origine_toiture_score: number;
  degat_des_eaux_score: number;
  condensation_score: number;
  sinistre_probable: boolean;
}

/** Hypothèses physiques — Tête 3 · Déduction. */
export interface Head3DeductionInput extends Head3HypothesisScores {
  originFromAbove: boolean;
  neighborInvolved: boolean;
  originCandidates: string[];
  triggers: string[];
}

/** Origine IRSI / recours — Tête 4. */
export type IrsiOriginKind =
  | 'parties_communes'
  | 'voisin'
  | 'privative_locataire'
  | 'entreprise'
  | 'tiers_exterieur'
  | 'incertaine';

export interface IrsiRecoursHint {
  originKind: IrsiOriginKind;
  gestionnaire: string;
  recours: string;
}

/** États et doctrine — Tête 4 · Décision. */
export interface Head4DecisionInput {
  sinistre_candidat: boolean;
  candidateStates: string[];
  doctrineNotes: string[];
  irsiRecours: IrsiRecoursHint | null;
}

/** Thèmes de parole — Tête 5 · Résolution. */
export interface Head5ResolutionInput {
  speechThemes: string[];
  interlocutor: GrockInterlocutor;
  mandatoryParoleNotes: string[];
}

/** Snapshot journalisable (admin / debug) — champs pilotés par le pack actif. */
export interface HeadInputsJournalSnapshot {
  infiltration_score: number | null;
  degat_des_eaux_score: number | null;
  sinistre_probable: boolean;
  sinistre_candidat: boolean;
  candidateStates: string[];
  speechThemes: string[];
  irsiOriginKind: IrsiOriginKind | null;
}
