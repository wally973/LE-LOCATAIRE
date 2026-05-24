/**
 * Règles métier plomberie — encastré et douche sans accès = bailleur.
 */
import { normalizeForElectricityRules as normalize } from './lia-electricity-rules';

export type PlumbingCharge = 'BAILLEUR' | 'LOCATAIRE';

/** Canalisation ou réseau encastré / collectif. */
export function isEmbeddedPlumbing(text: string): boolean {
  const t = normalize(text);
  return (
    /encastr|dans le mur|reseau collectif|colonne|parties communes|toiture|facade|fissure structure/.test(
      t,
    ) || /canalisation.*(immeuble|logement|fixe)/.test(t)
  );
}

/** Bac à douche / receveur : siphon ou évacuation non accessibles → bailleur. */
export function isShowerInaccessibleDrain(text: string): boolean {
  const t = normalize(text);
  const shower =
    /\b(douche|bac a douche|bac de douche|receveur|cabine de douche)\b/.test(t) ||
    (/\bsalle de bain\b/.test(t) &&
      /\b(siphon|bonde|evacuation|bac a douche|receveur)\b/.test(t));
  const drainIssue =
    /\b(siphon|bonde|evacuation|evacue|bouch|fuite|stagne|ne s.?ecoule|eau qui reste)\b/.test(
      t,
    );
  const noTrap =
    /\b(sans trappe|pas de trappe|trappe de visite|inaccessible|pas d.?acces|sous le receveur|sous la douche|sans acces)\b/.test(
      t,
    );
  if (!shower || !drainIssue) return false;
  if (/\b(evier|lavabo)\b/.test(t) && !/\b(douche|receveur|bac)\b/.test(t)) {
    return false;
  }
  return noTrap || /\b(douche|receveur|bac a douche)\b/.test(t);
}

export function resolvePlumbingCharge(text: string): PlumbingCharge | null {
  if (isEmbeddedPlumbing(text) || isShowerInaccessibleDrain(text)) {
    return 'BAILLEUR';
  }
  return null;
}
