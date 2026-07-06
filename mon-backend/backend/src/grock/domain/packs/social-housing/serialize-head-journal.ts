import type { GrockHeadInputs } from '../../../head-input/head-input.types';
import type { HeadInputsJournalSnapshot } from '../../head-pack.contract';

/** Journal T3–T5 — pack logement social. */
export function serializeSocialHousingHeadInputsJournal(
  inputs: GrockHeadInputs,
): HeadInputsJournalSnapshot {
  return {
    infiltration_score: inputs.head3.infiltration_score,
    degat_des_eaux_score: inputs.head3.degat_des_eaux_score,
    sinistre_probable: inputs.head3.sinistre_probable,
    sinistre_candidat: inputs.head4.sinistre_candidat,
    candidateStates: inputs.head4.candidateStates,
    speechThemes: inputs.head5.speechThemes,
    irsiOriginKind: inputs.head4.irsiRecours?.originKind ?? null,
  };
}
