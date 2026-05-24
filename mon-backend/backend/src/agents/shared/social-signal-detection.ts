/**
 * Détection d’un signalement non technique → volet social / référent.
 */
function norm(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

const SOCIAL_KEYWORDS = [
  'impay',
  'loyer impay',
  'pas payer',
  'payer le loyer',
  'payer mon loyer',
  'plus a payer',
  'plus à payer',
  'difficult',
  'financier',
  'rsa',
  'caf',
  'aide sociale',
  'surendett',
  'expulsion',
  'huissier',
  'violence',
  'harcelement',
  'harcèlement',
  'deces',
  'décès',
  'deuil',
  'divorce',
  'sans emploi',
  'chomage',
  'chômage',
  'preavis',
  'préavis',
  'quitter le logement',
];

/** True si le texte évoque une situation sociale plutôt qu’un désordre technique. */
export function detectSocialSignal(text: string): boolean {
  const t = norm(text);
  return SOCIAL_KEYWORDS.some((k) => t.includes(k));
}
