import type {
  Head3DeductionInput,
  Head4DecisionInput,
  Head5ResolutionInput,
} from '../../../domain/head-pack.contract';
import type { GrockInterlocutor } from '../../../kernel/grock-interlocutor';

/**
 * Tête 5 — thèmes de parole attendus (checklist, pas de texte figé).
 */
export function buildHead5ResolutionInput(
  head3: Head3DeductionInput,
  head4: Head4DecisionInput,
  interlocutor: GrockInterlocutor,
): Head5ResolutionInput {
  const speechThemes: string[] = [];
  const mandatoryParoleNotes: string[] = [];

  if (head3.degat_des_eaux_score >= 4) {
    speechThemes.push('eau_fuite');
  }

  const sinistreTrack = head4.sinistre_candidat || head3.sinistre_probable;

  if (sinistreTrack) {
    speechThemes.push(
      'securite',
      'photo',
      'assurance_sinistre',
      'delai_5j',
      'technicien_transmission',
      'procedure_locataire',
    );
    mandatoryParoleNotes.push(
      'Couvrir sécurisation, photos/preuves, déclaration assurance (~5 jours ouvrés) — sans promettre d’indemnisation.',
    );
  } else {
    speechThemes.push('technicien_transmission');
  }

  if (head3.originFromAbove || head3.origine_voisin_score >= 4) {
    speechThemes.push('origine_superieure', 'prevenir_voisin_dessus', 'constat_amiable');
    mandatoryParoleNotes.push(
      'Proposer au locataire de prévenir le voisin du dessus pour l’alerter — pas seulement « nous alerterons le voisin ».',
    );
  } else if (head3.neighborInvolved) {
    speechThemes.push('voisin', 'constat_amiable');
  }

  if (head4.irsiRecours?.originKind === 'parties_communes') {
    speechThemes.push('bailleur_patrimoine');
  }

  return {
    speechThemes: [...new Set(speechThemes)],
    interlocutor,
    mandatoryParoleNotes: [...new Set(mandatoryParoleNotes)],
  };
}

const THEME_LABELS: Record<string, string> = {
  securite: 'sécurisation (zone humide, électricité)',
  photo: 'photos / preuves',
  assurance_sinistre: 'déclaration assurance habitation',
  delai_5j: 'délai indicatif 5 jours ouvrés',
  constat_amiable: 'constat amiable dégât des eaux (si origine voisine)',
  origine_superieure: 'origine au-dessus (étage, logement du dessus, toiture)',
  prevenir_voisin_dessus: 'proposer au locataire de prévenir le voisin du dessus',
  bailleur_patrimoine: 'bailleur : toiture, parties communes, coordination patrimoine',
  voisin: 'voisin / logement du dessus',
  eau_fuite: 'eau / infiltration constatée',
  technicien_transmission: 'transmission technicien bailleur',
  procedure_locataire: 'marche à suivre locataire',
};

export function renderHead5PromptBlock(input: Head5ResolutionInput): string {
  const labels = input.speechThemes.map((t) => THEME_LABELS[t] ?? t);
  const lines = [
    '--- Tête 5 · RÉSOLUTION — thèmes parole attendus ---',
    `Interlocuteur : ${input.interlocutor}.`,
    'Thèmes à couvrir dans acknowledgment (formulation libre, 4–6 phrases) :',
  ];
  for (const label of labels) lines.push(`  • ${label}`);
  if (input.mandatoryParoleNotes.length) {
    lines.push('Consignes obligatoires (sens exact, formulation libre) :');
    for (const note of input.mandatoryParoleNotes) lines.push(`  ⚠ ${note}`);
  }
  lines.push('Ne répète pas le tour précédent — sécurité proportionnée en premier si danger.');
  return lines.join('\n');
}
