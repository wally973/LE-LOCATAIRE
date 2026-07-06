/**
 * Nettoyage textuel du signal entrant — sans interprétation ni correction sémantique.
 */

/** Normalise unicode, espaces et sauts de ligne ; préserve le sens déclaré. */
export function normalizeSignalText(raw: string | undefined | null): string {
  if (!raw?.trim()) return '';
  return raw
    .normalize('NFC')
    .replace(/\r\n/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Compte les champs texte effectivement transformés (traçabilité Couche 0). */
export function countNormalizedFields(before: string[], after: string[]): number {
  let n = 0;
  for (let i = 0; i < before.length; i++) {
    if (before[i] !== after[i]) n++;
  }
  return n;
}
