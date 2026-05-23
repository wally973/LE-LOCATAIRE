/**
 * Humidité / moisissures — sécurité juridique (Guyane, pièce humide, locataires bricoleurs).
 * Principe : entretien locatif / essais locataire → LOCATAIRE si la photo n’expose pas
 * de dégradation structurelle manifeste ; sinon BAILLEUR.
 */
import type { PathologistResult } from '../ai-routing/agents/pathologist.types';

export function normalizeHumidityText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export interface HumidityChargeSignals {
  tenantBricolage: boolean;
  infiltrationStructure: boolean;
  structuralDegradationVisible: boolean | null;
  tenantSurfaceOnly: boolean | null;
  hasPhoto: boolean;
}

const STRUCTURAL_KEYWORDS = [
  'fissure',
  'infiltration',
  'salpetre',
  'saltpetre',
  'remontee capillaire',
  'remontée',
  'cloqu',
  'bulle peinture',
  'decollement',
  'décollement',
  'effritement',
  'mur porteur',
  'toiture',
  'facade',
  'façade',
  'plafond affaisse',
  'trace d eau horizontal',
  'tache brun clair bande',
];

const SURFACE_ONLY_KEYWORDS = [
  'coin',
  'angle froid',
  'condensation',
  'petite zone',
  'localise',
  'localisé',
  'surface',
  'joint silicone',
  'salle de bain',
  'fenetre',
  'fenêtre',
];

const BRICOLAGE_KEYWORDS = [
  'bricol',
  'j ai essaye',
  "j'ai essaye",
  'j ai traite',
  'produit anti',
  'javel',
  'peinture',
  'deshumidificateur',
  'déshumidificateur',
  'aere',
  'aéré',
  'ventil',
  'nettoye',
  'nettoyé',
  'deja fait',
  'déjà fait',
];

export function isTenantBricolageContext(text: string): boolean {
  const t = normalizeHumidityText(text);
  return BRICOLAGE_KEYWORDS.some((k) => t.includes(k));
}

export function inferHumidityPhotoFromText(
  text: string,
  hasPhoto: boolean,
): PathologistResult['humidityPhoto'] | undefined {
  if (!hasPhoto) return undefined;
  const t = normalizeHumidityText(text);
  const structural = STRUCTURAL_KEYWORDS.some((k) => t.includes(k));
  const surfaceOnly =
    !structural &&
    (SURFACE_ONLY_KEYWORDS.some((k) => t.includes(k)) ||
      (/moisissure|humidit|moisi/.test(t) && !/infiltration|fissure/.test(t)));
  const indicators: string[] = [];
  for (const k of STRUCTURAL_KEYWORDS) {
    if (t.includes(k)) indicators.push(k);
  }
  return {
    structuralDegradationVisible: structural,
    tenantSurfaceNeglectOnly: surfaceOnly && !structural,
    indicators,
  };
}

export function parseHumidityChargeSignals(
  contextText: string,
  patho: PathologistResult,
  hasPhoto: boolean,
): HumidityChargeSignals {
  const t = normalizeHumidityText(contextText);
  const photo =
    patho.humidityPhoto ?? inferHumidityPhotoFromText(contextText, hasPhoto);

  return {
    tenantBricolage: isTenantBricolageContext(contextText),
    infiltrationStructure:
      /infiltration|toiture|facade|façade|mur porteur|colonne|pluie/.test(t),
    structuralDegradationVisible: photo?.structuralDegradationVisible ?? null,
    tenantSurfaceOnly: photo?.tenantSurfaceNeglectOnly ?? null,
    hasPhoto,
  };
}

export type HumidityCharge = 'BAILLEUR' | 'LOCATAIRE' | 'ESCALADE_BAILLEUR';

/**
 * Charge bailleur si dégradation structurelle visible à l’analyse (photo ou signes forts).
 * Locataire bricoleur + photo sans dégradation manifeste du bâti → LOCATAIRE.
 */
export function resolveHumidityCharge(
  signals: HumidityChargeSignals,
): HumidityCharge | null {
  if (signals.infiltrationStructure) {
    return 'BAILLEUR';
  }

  if (signals.structuralDegradationVisible === true) {
    return 'BAILLEUR';
  }

  if (
    signals.hasPhoto &&
    signals.structuralDegradationVisible === false &&
    (signals.tenantSurfaceOnly === true || signals.tenantBricolage)
  ) {
    return 'LOCATAIRE';
  }

  if (signals.tenantBricolage && signals.hasPhoto) {
    return 'LOCATAIRE';
  }

  if (signals.tenantBricolage && !signals.hasPhoto) {
    return 'LOCATAIRE';
  }

  if (
    signals.hasPhoto &&
    signals.structuralDegradationVisible === false &&
    !signals.infiltrationStructure
  ) {
    return 'LOCATAIRE';
  }

  if (!signals.hasPhoto && signals.tenantBricolage) {
    return 'LOCATAIRE';
  }

  if (signals.hasPhoto && signals.structuralDegradationVisible === null) {
    return 'ESCALADE_BAILLEUR';
  }

  return null;
}
