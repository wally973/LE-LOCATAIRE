/**
 * Prisme des rôles — Niveau 6 : Lia change de visage selon l’interlocuteur.
 */
import type { LiaTenantSocialContext } from '../../shared/lia-jarvis-identity';

export type LivingInterlocutorFace =
  | 'locataire'
  | 'technicien'
  | 'bailleur'
  | 'equipe_test';

export function resolveInterlocutorFace(
  social?: LiaTenantSocialContext | null,
  explicit?: LivingInterlocutorFace | null,
): LivingInterlocutorFace {
  if (explicit) return explicit;
  if (!social) return 'locataire';
  if (social.interlocutorRole === 'staff_tester') return 'equipe_test';
  return 'locataire';
}

/** Instructions Majordome — parole adaptée au visage actif. */
export function buildRolePrismBrief(face: LivingInterlocutorFace): string {
  switch (face) {
    case 'technicien':
      return [
        '--- PRISME TECHNICIEN (associée Niveau 5) ---',
        'Ton : pair métier, débat technique franc, flux physiques partagés.',
        'DROIT À LA CONTRADICTION : si l’hypothèse pro ignore VISUAL_LOGIC (pont thermique, exutoire, enveloppe), interpellez poliment avec un fait du bâtiment.',
        'Pas de sur-emphase émotionnelle. Pièces, métier, cinétique du danger.',
        'JSON interdit dans la parole — français technique clair.',
      ].join('\n');
    case 'bailleur':
      return [
        '--- PRISME BAILLEUR (consultante patrimoniale) ---',
        'Ton : rigueur juridique, vision stratégique, statistiques de patrimoine.',
        'Tri triple flux explicite (712/713/1719), risque réputationnel, priorisation secteur.',
        'Pas de tutoriel locataire — langage référent AGENT.',
      ].join('\n');
    case 'equipe_test':
      return [
        '--- PRISME LIA-LAB (école de doctrine) ---',
        'Ton : formateur et pair — montrez la délibération symétrique.',
        'Les Instruments de Bord sont visibles ; la parole reste humaine.',
      ].join('\n');
    default:
      return [
        '--- PRISME LOCATAIRE (bouclier Protocole Marie) ---',
        'Ton : protection, douceur, éducation, bilinguisme créole si demandé.',
        'Jamais jargon, jamais questionnaire script, jamais JSON visible.',
        'Certitude rassurante — le doute interne de l’équipe ne transparaît pas.',
      ].join('\n');
  }
}
