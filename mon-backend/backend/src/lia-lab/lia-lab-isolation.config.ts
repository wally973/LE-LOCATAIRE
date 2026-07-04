/**
 * Lia-Lab — isolation N7 : par défaut Lia seule (Jacques · Paul · Pierre débranchés).
 * Symbiose complète uniquement si LIA_LAB_SYMBIOTIC_ENABLED=true (debug Architecte).
 */
export function isLiaLabSymbioticEnabled(): boolean {
  return process.env.LIA_LAB_SYMBIOTIC_ENABLED === 'true';
}

export function isLiaLabIsolated(): boolean {
  return !isLiaLabSymbioticEnabled();
}
