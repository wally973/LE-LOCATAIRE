import type { PreprocessedSignal } from '../../../preprocessor/preprocessor.types';
import { buildSignalCorpus } from '../../../head-input/corpus.util';
import type { Head3DeductionInput, Head4DecisionInput } from '../../../domain/head-pack.contract';
import type { Head1AnalysisInput } from '../../../head-input/head-input.types';
import { buildIrsiRecoursHint, renderIrsiRecoursBlock } from './head4-irsi-recours';

/**
 * Tête 4 — états candidats, doctrine assurance, IRSI/recours.
 */
export function buildHead4DecisionInput(
  head1: Head1AnalysisInput,
  head3: Head3DeductionInput,
  signal: PreprocessedSignal,
): Head4DecisionInput {
  const candidateStates: string[] = [];
  const doctrineNotes: string[] = [];
  const corpus = buildSignalCorpus(signal);

  const sinistre_candidat = head3.sinistre_probable || head3.degat_des_eaux_score >= 7;

  if (!sinistre_candidat && head3.degat_des_eaux_score < 6) {
    return {
      sinistre_candidat: false,
      candidateStates: ['ASK_ONE_QUESTION', 'NEED_PHOTO', 'READY_TICKET'],
      doctrineNotes: [],
      irsiRecours: null,
    };
  }

  if (sinistre_candidat) candidateStates.push('sinistre_candidat');
  candidateStates.push('sinistre', 'bailleur_responsable');

  if (!head1.hasPhoto) candidateStates.push('NEED_PHOTO');
  if (!head1.roomKnown || head3.origine_voisin_score >= 4 && head3.origine_toiture_score >= 4) {
    candidateStates.push('ASK_ONE_QUESTION');
  }
  if (head3.origine_voisin_score < 5 && head3.origine_toiture_score < 5) {
    candidateStates.push('ASK_ONE_QUESTION');
  }

  doctrineNotes.push(
    'Dégât des eaux actif : state sinistre si origine voisine, collective ou incertaine avec écoulement.',
  );
  doctrineNotes.push(
    'Déclaration assurance habitation — délai indicatif 5 jours ouvrés (sans promettre d’indemnisation).',
  );
  doctrineNotes.push('Constat amiable dégât des eaux si origine voisine confirmée ou probable.');
  if (head3.originFromAbove) {
    doctrineNotes.push(
      'Infiltration plafond : nommer origine au-dessus (voisin OU patrimoine bailleur) ; proposer au locataire de prévenir le voisin du dessus.',
    );
  }
  if (signal.signalQuality < 4) {
    doctrineNotes.push('signalQuality faible — NEED_PHOTO ou ASK_ONE_QUESTION avant conclusion ferme.');
  }
  doctrineNotes.push('Coordination bailleur / technicien — ne remplace pas la déclaration assurance locataire.');

  const irsiRecours = buildIrsiRecoursHint(head1, head3, corpus);
  if (irsiRecours) {
    doctrineNotes.push(renderIrsiRecoursBlock(irsiRecours));
  }

  return {
    sinistre_candidat,
    candidateStates: [...new Set(candidateStates)],
    doctrineNotes,
    irsiRecours,
  };
}

export function renderHead4PromptBlock(input: Head4DecisionInput): string {
  const lines = [
    '--- Tête 4 · DÉCISION — états candidats, doctrine, IRSI ---',
    `sinistre_candidat (capteur) : ${input.sinistre_candidat ? 'oui' : 'non'}`,
    `États sur la table : ${input.candidateStates.join(', ')}.`,
  ];
  if (input.doctrineNotes.length) {
    lines.push('Doctrine applicable :');
    for (const note of input.doctrineNotes) {
      for (const part of note.split('\n')) lines.push(`  • ${part}`);
    }
  }
  lines.push('Tranche state et decisionConfidence — modulé par signalQuality si faible.');
  return lines.join('\n');
}
