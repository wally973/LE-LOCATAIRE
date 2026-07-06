/**
 * Interlocuteur Grock — même moteur cognitif (5 têtes), quatre surfaces.
 *
 * Le JSON de sortie reste identique ; seul le sens de `acknowledgment` change.
 */

export type GrockInterlocutor = 'tenant' | 'admin' | 'technician' | 'landlord';

export function renderInterlocutorBlock(
  interlocutor: GrockInterlocutor,
  context?: string | null,
): string {
  if (interlocutor === 'admin') {
    const lines = [
      '--- INTERLOCUTEUR : ADMIN (gouvernance) ---',
      'Tu parles à l’Architecte du système.',
      'Tout est visible : scores, raisonnement, signal prétraité (traces système).',
      'thinking doit contenir le bloc [SCORES] ; cite les faits du contexte fourni, n’invente pas de chiffres absents.',
      'acknowledgment = réponse directe à l’Architecte, langage clair et professionnel.',
      'note_interne = synthèse technique pour le dossier.',
    ];
    if (context?.trim()) {
      lines.push('', '--- Contexte administration (données réelles) ---', context.trim());
    }
    return lines.join('\n');
  }

  if (interlocutor === 'technician') {
    return [
      '--- INTERLOCUTEUR : TECHNICIEN (terrain) ---',
      'Scores visibles : dangerLevel, factExtractionConfidence, signalQuality.',
      'Perception brute visible — parole technique (hypothèses ordonnées, vérifications sur place, risques).',
      'acknowledgment = ta parole au technicien ; note_interne = synthèse pour le dossier.',
    ].join('\n');
  }

  if (interlocutor === 'landlord') {
    const lines = [
      '--- INTERLOCUTEUR : BAILLEUR (patrimoine) ---',
      'Scores visibles : inferenceConfidence, decisionConfidence, signalQuality.',
      'Responsabilité modulée — parole décisionnelle (charge, urgence, preuves manquantes, coordination technicien).',
      'acknowledgment = synthèse pour le bailleur ; note_interne = brief technique pour le dossier.',
    ];
    if (context?.trim()) {
      lines.push('', '--- Contexte dossier (données réelles) ---', context.trim());
    }
    return lines.join('\n');
  }

  return [
    '--- INTERLOCUTEUR : LOCATAIRE (mobile) ---',
    'Ton rassurant — 4 à 6 phrases courtes dans acknowledgment.',
    'Jamais de scores, jamais de dangerLevel brut, jamais de responsabilité explicite (« charge locataire/bailleur »).',
    'Dis ce qu’il faut faire maintenant ; valide les bons gestes ; UNE question si l’origine bloque.',
    'Si l’origine n’est pas claire (ex. fuite chauffe-eau intérieur vs toiture), pose UNE seule question avant de conclure.',
    'acknowledgment = message visible locataire ; note_interne = raisonnement interne.',
  ].join('\n');
}
