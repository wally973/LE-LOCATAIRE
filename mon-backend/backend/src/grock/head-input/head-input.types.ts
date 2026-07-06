import type {
  Head3DeductionInput,
  Head4DecisionInput,
  Head5ResolutionInput,
  HeadInputsJournalSnapshot,
} from '../domain/head-pack.contract';

/** Faits structurés — Tête 1 · Analyse (sans métier). */
export interface Head1AnalysisInput {
  waterSignal: boolean;
  activeWater: boolean;
  ceilingSignal: boolean;
  humidityTraces: boolean;
  luminaireNearby: boolean;
  hasPhoto: boolean;
  roomKnown: boolean;
  symptomAnchor: string | null;
  waterAspect: string | null;
  buildingFloor: string | null;
  triggers: string[];
}

/** Drapeaux danger — Tête 2. */
export type DangerFlag =
  | 'eau_electricite_proximite'
  | 'zone_humide'
  | 'ecoulement_actif'
  | 'texte_image_ecart'
  | 'photo_sans_perception';

/** Cohérence et danger — Tête 2 · Vérification. */
export interface Head2VerificationInput {
  electricalRisk: boolean;
  indicativeDangerLevel: number;
  perceptionAvailable: boolean;
  dangerFlags: DangerFlag[];
  textImageGaps: string[];
  triggers: string[];
}

/** Artefacts chaînés T1→T5 + blocs prompt (T3–T5 = sortie pack). */
export interface GrockHeadInputs {
  head1: Head1AnalysisInput;
  head2: Head2VerificationInput;
  head3: Head3DeductionInput;
  head4: Head4DecisionInput;
  head5: Head5ResolutionInput;
  promptBlocks: string[];
}

export type { HeadInputsJournalSnapshot };
