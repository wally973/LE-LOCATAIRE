/** Normalisation texte pour matching Savoir / juridique. */
export function normClinicalText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}
