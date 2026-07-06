import type { GrockHeadInputs } from '../head-input/head-input.types';
import type { HeadInputsJournalSnapshot } from './head-pack.contract';

/** Journal T3–T5 — pack neutre (aucun signal métier). */
export function serializeEmptyHeadInputsJournal(
  _inputs: GrockHeadInputs,
): HeadInputsJournalSnapshot {
  return {
    infiltration_score: null,
    degat_des_eaux_score: null,
    sinistre_probable: false,
    sinistre_candidat: false,
    candidateStates: ['ASK_ONE_QUESTION', 'NEED_PHOTO', 'READY_TICKET'],
    speechThemes: ['technicien_transmission'],
    irsiOriginKind: null,
  };
}
