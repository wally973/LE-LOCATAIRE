/**
 * Contexte REF_EAU_SAVONNEUSE — eau savonneuse en R+1 (refoulement EU probable).
 */
import type { DiagnosticSensors } from './lia-diagnostic-state.types';

function norm(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Capteurs cohérents avec refoulement EU en étage intermédiaire (golden REF). */
export function isSavonneuseR1RefoulementSensors(
  sensors: DiagnosticSensors,
): boolean {
  const aspect = norm(sensors.water_aspect ?? '');
  const floor = norm(sensors.building_floor ?? '');
  const soapy = /savon|mousse/.test(aspect);
  const r1 =
    /\br\+1\b|r\s*\+\s*1|1er\s+etage|premier\s+etage|etage\s+1\b/.test(floor);
  return soapy && r1;
}

/** Note sinistre / assurance (charge collective, pas dégât des eaux privatif classique). */
export const INSURANCE_REFOULEMENT_EU_NOTE =
  'Indice fort de refoulement d’eaux usées (eau savonneuse/mousseuse) au R+1 : la responsabilité ' +
  'semble collective (réseau d’évacuation de l’immeuble, colonnes communes) plutôt qu’un sinistre ' +
  'privatif type fuite d’eau potable. Vérifier si d’autres logements sont touchés le soir aux heures ' +
  'de pointe ; l’assurance habitation du locataire couvre en principe les dégâts dans le lot, mais ' +
  'l’intervention sur la cause relève du bailleur / copropriété (voisinage amont possible).';

/** Slugs juridiques prioritaires pour colonnes / réseaux collectifs. */
export const LEGAL_REFOULEMENT_EU_SLUGS = [
  'plumbing-colonne-bailleur',
  'code-civil-1719-bailleur',
  'decret-87-712-reparations-locatives',
] as const;

export const LEGAL_REFOULEMENT_EU_SUMMARY =
  'Eau savonneuse au R+1 : les colonnes et réseaux d’évacuation collectifs relèvent de la charge ' +
  'du bailleur (grosses réparations, art. 1719 C. civ.), pas des menues réparations locatives ' +
  '(décret 87-712). Le locataire signale et documente sans intervenir sur les parties communes.';
