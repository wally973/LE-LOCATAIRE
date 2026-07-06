import type {
  Head3PackOutput,
  Head4PackOutput,
  Head5PackOutput,
} from './head-enrichment.types';
import type { GrockInterlocutor } from '../kernel/grock-interlocutor';

const EMPTY_HEAD3_BLOCK =
  '--- Tête 3 · DÉDUCTION — (pack neutre) ---\nAucune hypothèse métier branchée — score inferenceConfidence selon le pack actif.';

const EMPTY_HEAD4_BLOCK =
  '--- Tête 4 · DÉCISION — (pack neutre) ---\nÉtats candidats : ASK_ONE_QUESTION, NEED_PHOTO, READY_TICKET.';

function emptyHead5Block(interlocutor: GrockInterlocutor): string {
  return [
    '--- Tête 5 · RÉSOLUTION — (pack neutre) ---',
    `Interlocuteur : ${interlocutor}.`,
    'Thèmes standard : une question, une validation ou une transmission.',
  ].join('\n');
}

/** Enrichissement T3 vide — pack sans métier (défaut sûr). */
export function enrichHead3Empty(): Head3PackOutput {
  return {
    infiltration_score: 0,
    origine_voisin_score: 0,
    origine_toiture_score: 0,
    degat_des_eaux_score: 0,
    condensation_score: 0,
    sinistre_probable: false,
    originFromAbove: false,
    neighborInvolved: false,
    originCandidates: [],
    triggers: [],
    promptBlock: EMPTY_HEAD3_BLOCK,
  };
}

/** Enrichissement T4 vide. */
export function enrichHead4Empty(): Head4PackOutput {
  return {
    sinistre_candidat: false,
    candidateStates: ['ASK_ONE_QUESTION', 'NEED_PHOTO', 'READY_TICKET'],
    doctrineNotes: [],
    irsiRecours: null,
    promptBlock: EMPTY_HEAD4_BLOCK,
  };
}

/** Enrichissement T5 vide. */
export function enrichHead5Empty(interlocutor: GrockInterlocutor): Head5PackOutput {
  return {
    speechThemes: ['technicien_transmission'],
    interlocutor,
    mandatoryParoleNotes: [],
    promptBlock: emptyHead5Block(interlocutor),
  };
}
